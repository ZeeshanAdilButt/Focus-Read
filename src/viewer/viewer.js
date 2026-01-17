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
let lastClickedWordIndex = -1; // Track right-click position
let paragraphStarts = [0]; // Track paragraph boundaries

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

// Track right-click position to find word under cursor
pdfContainer.addEventListener('contextmenu', (e) => {
    if (!pdfLoaded || allWords.length === 0) return;
    
    // Find which page was clicked
    const pageDiv = e.target.closest('.pdf-page');
    if (!pageDiv) return;
    
    const pageNum = parseInt(pageDiv.dataset.pageNumber);
    const pageRect = pageDiv.getBoundingClientRect();
    
    // Get click position relative to page
    const clickX = e.clientX - pageRect.left;
    const clickY = e.clientY - pageRect.top;
    
    // Find closest word on this page
    let closestIndex = -1;
    let closestDist = Infinity;
    
    allWords.forEach((word, idx) => {
        if (word.page !== pageNum) return;
        
        // Check if click is within word bounds (with some padding)
        const padding = 10;
        const inX = clickX >= word.x - padding && clickX <= word.x + word.width + padding;
        const inY = clickY >= word.y - padding && clickY <= word.y + word.height + padding;
        
        if (inX && inY) {
            const dist = Math.abs(clickX - (word.x + word.width / 2)) + Math.abs(clickY - (word.y + word.height / 2));
            if (dist < closestDist) {
                closestDist = dist;
                closestIndex = idx;
            }
        }
    });
    
    // If no exact match, find closest word on this page
    if (closestIndex === -1) {
        allWords.forEach((word, idx) => {
            if (word.page !== pageNum) return;
            
            const dist = Math.sqrt(
                Math.pow(clickX - (word.x + word.width / 2), 2) + 
                Math.pow(clickY - (word.y + word.height / 2), 2)
            );
            if (dist < closestDist) {
                closestDist = dist;
                closestIndex = idx;
            }
        });
    }
    
    if (closestIndex !== -1) {
        lastClickedWordIndex = closestIndex;
        console.log("Flow Mate PDF: Right-clicked at word index", closestIndex, "word:", allWords[closestIndex].word);
    }
});

async function loadPdf(data) {
    pdfContainer.innerHTML = ''; // Clear previous
    allWords = []; 
    paragraphStarts = [0]; // Reset paragraph tracking
    
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
    
    // Detect paragraph boundaries based on Y-position jumps
    detectParagraphs();
    
    console.log("Flow Mate: PDF rendered with " + allWords.length + " words and " + paragraphStarts.length + " paragraphs.");
}

// Detect paragraphs based on significant Y-position changes
function detectParagraphs() {
    paragraphStarts = [0];
    
    if (allWords.length < 2) return;
    
    let lastPage = allWords[0].page;
    let lastY = allWords[0].y;
    let lastLineHeight = allWords[0].height;
    
    for (let i = 1; i < allWords.length; i++) {
        const word = allWords[i];
        
        // New page is always a new paragraph
        if (word.page !== lastPage) {
            if (!paragraphStarts.includes(i)) {
                paragraphStarts.push(i);
            }
            lastPage = word.page;
            lastY = word.y;
            lastLineHeight = word.height;
            continue;
        }
        
        // Significant Y jump (more than 1.5x line height) indicates new paragraph
        const yDiff = word.y - lastY;
        const threshold = lastLineHeight * 1.5;
        
        if (yDiff > threshold) {
            if (!paragraphStarts.includes(i)) {
                paragraphStarts.push(i);
            }
        }
        
        lastY = word.y;
        lastLineHeight = word.height;
    }
    
    // Sort paragraph starts
    paragraphStarts.sort((a, b) => a - b);
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
            console.log("Flow Mate Viewer: Sending content with", paragraphStarts.length, "paragraphs");
            sendResponse({ 
                content: fullText,
                paragraphStarts: paragraphStarts
            });
        }
        return true;
    } else if (request.action === "getClickedWordIndex") {
        // Return the word index where user last right-clicked
        console.log("Flow Mate Viewer: Returning clicked word index", lastClickedWordIndex);
        sendResponse({ wordIndex: lastClickedWordIndex });
        return true;
    } else if (request.action === "resetHighlightPosition") {
        // Reset tracking for new reading session
        lastClickedWordIndex = -1;
        sendResponse({ success: true });
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
