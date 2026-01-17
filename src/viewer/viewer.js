import * as pdfjsLib from 'pdfjs-dist';
// Use locally bundled worker (copied by webpack)
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

const fileInput = document.getElementById('fileInput');
const pdfContainer = document.getElementById('pdfContainer');
const pageInput = document.getElementById('pageInput');
const pageCountSpan = document.getElementById('pageCount');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const toggleSelectBtn = document.getElementById('toggleSelect');

let pdfDoc = null;
let allWords = []; // Flat list of all words with location info
let pdfLoaded = false;
let currentPage = 1;
let totalPages = 0;
let textSelectionMode = false;

// Show status message in container
function showStatus(message, isError = false) {
    pdfContainer.innerHTML = `<div class="status-message" style="
        color: ${isError ? '#e74c3c' : '#888'};
        text-align: center;
        padding: 40px;
        font-size: 1.1rem;
    ">${message}</div>`;
}

showStatus('Select a PDF file to begin reading');

// File input handler
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        showStatus('Loading PDF...');
        try {
            const arrayBuffer = await file.arrayBuffer();
            await loadPdf(arrayBuffer);
            pdfLoaded = true;
            console.log("Flow Mate: PDF loaded successfully with", allWords.length, "words");
        } catch (err) {
            console.error("Flow Mate: Error loading PDF:", err);
            showStatus('Error loading PDF: ' + err.message, true);
            pdfLoaded = false;
        }
    }
});

// Page navigation
prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));

pageInput.addEventListener('change', (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages) {
        goToPage(page);
    } else {
        pageInput.value = currentPage;
    }
});

pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.target.blur();
    }
});

function goToPage(num) {
    if (num < 1 || num > totalPages || !pdfLoaded) return;
    
    currentPage = num;
    pageInput.value = num;
    updateNavButtons();
    
    // Scroll to the page
    const pageDiv = document.getElementById(`page-${num}`);
    if (pageDiv) {
        pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateNavButtons() {
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// Text selection toggle
toggleSelectBtn.addEventListener('click', () => {
    textSelectionMode = !textSelectionMode;
    toggleSelectBtn.classList.toggle('active', textSelectionMode);
    document.getElementById('selectLabel').textContent = textSelectionMode ? 'Selection ON' : 'Select Text';
    
    // Toggle selectable class on all text layers
    document.querySelectorAll('.text-layer').forEach(layer => {
        layer.classList.toggle('selectable', textSelectionMode);
    });
});

// Track scroll position to update current page
pdfContainer.addEventListener('scroll', () => {
    if (!pdfLoaded) return;
    
    const containerRect = pdfContainer.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;
    
    // Find which page is most visible
    let closestPage = 1;
    let closestDistance = Infinity;
    
    for (let i = 1; i <= totalPages; i++) {
        const pageDiv = document.getElementById(`page-${i}`);
        if (pageDiv) {
            const pageRect = pageDiv.getBoundingClientRect();
            const pageCenter = pageRect.top + pageRect.height / 2;
            const distance = Math.abs(pageCenter - containerCenter);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPage = i;
            }
        }
    }
    
    if (closestPage !== currentPage) {
        currentPage = closestPage;
        pageInput.value = currentPage;
        updateNavButtons();
    }
});

async function loadPdf(data) {
    pdfContainer.innerHTML = ''; // Clear previous
    allWords = []; 
    
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    totalPages = pdfDoc.numPages;
    pageCountSpan.innerText = totalPages;
    currentPage = 1;
    pageInput.value = 1;
    pageInput.max = totalPages;
    updateNavButtons();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        await renderPage(i);
    }
    
    console.log("Flow Mate: PDF rendered with " + allWords.length + " words.");
}

async function renderPage(num) {
    const page = await pdfDoc.getPage(num);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
    pageDiv.style.position = 'relative';
    pageDiv.dataset.pageNumber = num;
    pageDiv.id = `page-${num}`;
    pdfContainer.appendChild(pageDiv);

    // Canvas for PDF content
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    pageDiv.appendChild(canvas);

    const context = canvas.getContext('2d');
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;

    // Text Layer for selection and extraction
    const textContent = await page.getTextContent();
    
    // Create text layer div
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer';
    if (textSelectionMode) {
        textLayerDiv.classList.add('selectable');
    }
    pageDiv.appendChild(textLayerDiv);
    
    // Process each text item
    textContent.items.forEach((item) => {
        const itemText = item.str;
        if (!itemText.trim()) return;
        
        // PDF transform: [scaleX, skewY, skewX, scaleY, tx, ty]
        const tx = item.transform[4];
        const ty = item.transform[5];
        const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
        
        // Convert PDF coordinates to viewport coordinates
        const [viewX, viewY] = viewport.convertToViewportPoint(tx, ty);
        const itemHeight = fontSize * scale;
        
        // Create selectable text span
        const textSpan = document.createElement('span');
        textSpan.textContent = itemText;
        textSpan.style.left = `${viewX}px`;
        textSpan.style.top = `${viewY - itemHeight}px`;
        textSpan.style.fontSize = `${itemHeight}px`;
        textSpan.style.fontFamily = item.fontName || 'sans-serif';
        textLayerDiv.appendChild(textSpan);
        
        // Estimate width per character
        const charWidth = item.width / Math.max(1, itemText.length) * scale;
        
        // Split into words and calculate positions for highlighting
        const wordsInItem = itemText.split(/(\s+)/);
        let charOffset = 0;
        
        wordsInItem.forEach(segment => {
            const word = segment.trim();
            if (word) {
                const wordX = viewX + (charOffset * charWidth);
                const wordWidth = word.length * charWidth;
                
                allWords.push({
                    word: word,
                    page: num,
                    x: wordX,
                    y: viewY - itemHeight,
                    width: wordWidth,
                    height: itemHeight * 1.2
                });
            }
            charOffset += segment.length;
        });
    });
}

// Communication with Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Flow Mate Viewer: Received message", request.action);
    
    if (request.action === "getContent") {
        if (!pdfLoaded || allWords.length === 0) {
            console.log("Flow Mate Viewer: PDF not loaded yet, words:", allWords.length);
            sendResponse({ content: null, error: "No PDF loaded" });
        } else {
            const fullText = allWords.map(w => w.word).join(' ');
            console.log("Flow Mate Viewer: Sending content, length:", fullText.length);
            sendResponse({ content: fullText });
        }
        return true;
    } else if (request.action === "highlight") {
        const wordCount = request.wordCount || 1;
        if (request.text) {
            highlightWordsInPdf(request.index, wordCount);
        }
    } else if (request.action === "clearHighlight") {
        clearHighlights();
    }
    return false;
});

function highlightWordsInPdf(startIndex, wordCount = 1) {
    // Clear previous highlights
    clearHighlights();
    
    if (startIndex < 0 || startIndex >= allWords.length) return;
    
    const endIndex = Math.min(startIndex + wordCount - 1, allWords.length - 1);
    const firstWord = allWords[startIndex];
    
    // Update page number display
    if (firstWord.page !== currentPage) {
        currentPage = firstWord.page;
        pageInput.value = currentPage;
        updateNavButtons();
    }
    
    // Group words by page for efficient rendering
    const wordsByPage = {};
    for (let i = startIndex; i <= endIndex; i++) {
        const word = allWords[i];
        if (!wordsByPage[word.page]) {
            wordsByPage[word.page] = [];
        }
        wordsByPage[word.page].push(word);
    }
    
    // Create highlights for each page
    Object.entries(wordsByPage).forEach(([pageNum, words]) => {
        const pageDiv = document.getElementById(`page-${pageNum}`);
        if (!pageDiv) return;
        
        // Scroll first page into view
        if (parseInt(pageNum) === firstWord.page) {
            pageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Create highlight overlays for each word
        words.forEach(word => {
            const highlight = document.createElement('div');
            highlight.className = 'flowmate-pdf-highlight';
            highlight.style.cssText = `
                position: absolute;
                left: ${word.x - 2}px;
                top: ${word.y - 2}px;
                width: ${word.width + 4}px;
                height: ${word.height + 4}px;
                background: linear-gradient(135deg, rgba(231, 76, 60, 0.3), rgba(243, 156, 18, 0.2));
                border: 2px solid rgba(231, 76, 60, 0.8);
                border-radius: 3px;
                pointer-events: none;
                z-index: 50;
                box-shadow: 0 0 10px rgba(231, 76, 60, 0.4);
            `;
            pageDiv.appendChild(highlight);
        });
    });
    
    console.log(`Flow Mate: Highlighted words ${startIndex} to ${endIndex} on page ${firstWord.page}`);
}

function clearHighlights() {
    const overlays = document.querySelectorAll('.flowmate-pdf-highlight');
    overlays.forEach(o => o.remove());
}
