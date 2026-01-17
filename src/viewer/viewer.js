import * as pdfjsLib from 'pdfjs-dist';

// Use locally bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

// ========== DOM ELEMENTS ==========
const fileInput = document.getElementById('fileInput');
const pdfContainer = document.getElementById('pdfContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const loadingOverlay = document.getElementById('loadingOverlay');
const pageInput = document.getElementById('pageInput');
const pageCountSpan = document.getElementById('pageCount');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const toggleSelectBtn = document.getElementById('toggleSelect');
const readPageBtn = document.getElementById('readPageBtn');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLevelSpan = document.getElementById('zoomLevel');
const statusToast = document.getElementById('statusToast');
const statusMessage = document.getElementById('statusMessage');

// ========== STATE ==========
let pdfDoc = null;
let allWords = [];
let pdfLoaded = false;
let currentPage = 1;
let totalPages = 0;
let textSelectionMode = true;
let lastClickedWordIndex = -1;
let paragraphStarts = [0];
let currentScale = 1.5;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, duration = 3000) {
    statusMessage.textContent = message;
    statusToast.classList.remove('hidden');
    statusToast.classList.add('show');
    
    setTimeout(() => {
        statusToast.classList.remove('show');
        setTimeout(() => statusToast.classList.add('hidden'), 300);
    }, duration);
}

// ========== LOADING STATE ==========
function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

// Initialize text selection button as active (since textSelectionMode = true by default)
toggleSelectBtn.classList.add('active');

// ========== FILE INPUT HANDLER ==========
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        showLoading(true);
        welcomeScreen.classList.add('hidden');
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            await loadPdf(arrayBuffer);
            pdfLoaded = true;
            pdfContainer.classList.remove('hidden');
            showToast(`Loaded ${totalPages} pages • ${allWords.length.toLocaleString()} words`);
            console.log("Flow Mate: PDF loaded with", allWords.length, "words,", paragraphStarts.length, "paragraphs");
        } catch (err) {
            console.error("Flow Mate: Error loading PDF:", err);
            showToast('Error loading PDF: ' + err.message);
            welcomeScreen.classList.remove('hidden');
            pdfLoaded = false;
        } finally {
            showLoading(false);
        }
    }
});

// ========== PAGE NAVIGATION ==========
prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));

// Track if user is typing in page input
let isTypingPage = false;

pageInput.addEventListener('focus', () => {
    isTypingPage = true;
    // Store current value to restore on escape
    pageInput.dataset.originalValue = pageInput.value;
    pageInput.select();
});

pageInput.addEventListener('blur', () => {
    isTypingPage = false;
    // On blur without Enter, restore original value
    pageInput.value = currentPage;
});

pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const page = parseInt(pageInput.value);
        if (page >= 1 && page <= totalPages) {
            isTypingPage = false;
            goToPage(page);
        } else {
            pageInput.value = currentPage;
        }
        pageInput.blur();
    } else if (e.key === 'Escape') {
        pageInput.value = currentPage;
        pageInput.blur();
    }
});

function goToPage(num) {
    if (num < 1 || num > totalPages || !pdfLoaded) return;
    
    currentPage = num;
    pageInput.value = num;
    updateNavButtons();
    
    const pageDiv = document.getElementById(`page-${num}`);
    if (pageDiv) {
        pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateNavButtons() {
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// ========== ZOOM CONTROLS ==========
zoomInBtn.addEventListener('click', () => {
    if (currentScale < MAX_SCALE) {
        currentScale = Math.min(MAX_SCALE, currentScale + SCALE_STEP);
        smartReRenderPdf();
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (currentScale > MIN_SCALE) {
        currentScale = Math.max(MIN_SCALE, currentScale - SCALE_STEP);
        smartReRenderPdf();
    }
});

function updateZoomDisplay() {
    zoomLevelSpan.textContent = Math.round(currentScale * 100 / 1.5) + '%';
}

// Smart re-render: only re-render visible pages, reset others to placeholders
async function smartReRenderPdf() {
    if (!pdfDoc) return;
    
    showLoading(true);
    updateZoomDisplay();
    
    // Remember current page and scroll position
    const targetPage = currentPage;
    
    // Get visible pages (current ± 2)
    const visibleStart = Math.max(1, targetPage - 2);
    const visibleEnd = Math.min(totalPages, targetPage + 2);
    
    // Reset all pages to placeholders with new estimated sizes
    const estimatedWidth = Math.round(612 * currentScale);
    const estimatedHeight = Math.round(792 * currentScale);
    
    pdfContainer.innerHTML = '';
    allWords = [];
    paragraphStarts = [0];
    
    // Create all placeholder divs
    for (let i = 1; i <= totalPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page placeholder';
        pageDiv.id = `page-${i}`;
        pageDiv.dataset.pageNumber = i;
        pageDiv.style.width = `${estimatedWidth}px`;
        pageDiv.style.height = `${estimatedHeight}px`;
        pageDiv.innerHTML = `<div class="page-loading">Page ${i}</div>`;
        pdfContainer.appendChild(pageDiv);
    }
    
    // Render only visible pages
    for (let i = visibleStart; i <= visibleEnd; i++) {
        await renderPage(i);
    }
    
    // Sort and detect paragraphs for rendered pages
    sortWordsByReadingOrder();
    detectParagraphs();
    
    // Scroll to target page
    const targetDiv = document.getElementById(`page-${targetPage}`);
    if (targetDiv) {
        targetDiv.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    
    showLoading(false);
    
    // Re-setup lazy loading for other pages
    setupLazyLoading();
    
    // Extract remaining text in background
    setTimeout(() => extractRemainingText(1), 100);
}

// ========== TEXT SELECTION TOGGLE ==========
toggleSelectBtn.addEventListener('click', () => {
    textSelectionMode = !textSelectionMode;
    toggleSelectBtn.classList.toggle('active', textSelectionMode);
    
    document.querySelectorAll('.text-layer').forEach(layer => {
        layer.classList.toggle('selectable', textSelectionMode);
    });
    
    showToast(textSelectionMode ? 'Text selection enabled' : 'Text selection disabled');
});

// ========== READ PAGE BUTTON ==========
readPageBtn.addEventListener('click', () => {
    if (!pdfLoaded || allWords.length === 0) {
        showToast('Load a PDF first');
        return;
    }
    
    // Send message to sidepanel to load content
    chrome.runtime.sendMessage({ 
        action: "loadPdfContent",
        content: allWords.map(w => w.word).join(' '),
        paragraphStarts: paragraphStarts
    });
    
    showToast('Content sent to reader');
});

// ========== SCROLL TRACKING ==========
pdfContainer.addEventListener('scroll', () => {
    if (!pdfLoaded) return;
    
    const containerRect = pdfContainer.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;
    
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
        // Only update input if user is not actively typing
        if (!isTypingPage) {
            pageInput.value = currentPage;
        }
        updateNavButtons();
    }
});

// ========== RIGHT-CLICK WORD DETECTION ==========
pdfContainer.addEventListener('contextmenu', (e) => {
    if (!pdfLoaded || allWords.length === 0) return;
    
    const pageDiv = e.target.closest('.pdf-page');
    if (!pageDiv) return;
    
    const pageNum = parseInt(pageDiv.dataset.pageNumber);
    const pageRect = pageDiv.getBoundingClientRect();
    const clickX = e.clientX - pageRect.left;
    const clickY = e.clientY - pageRect.top;
    
    let closestIndex = -1;
    let closestDist = Infinity;
    
    // Find word at click position
    allWords.forEach((word, idx) => {
        if (word.page !== pageNum) return;
        
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
    
    // Fallback: find closest word on page
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
        console.log("Flow Mate PDF: Right-clicked word", closestIndex, ":", allWords[closestIndex].word);
    }
});

// ========== PDF LOADING ==========
async function loadPdf(data) {
    pdfContainer.innerHTML = '';
    allWords = [];
    paragraphStarts = [0];
    
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    totalPages = pdfDoc.numPages;
    pageCountSpan.textContent = totalPages;
    currentPage = 1;
    pageInput.value = 1;
    pageInput.max = totalPages;
    updateNavButtons();
    updateZoomDisplay();

    // Create placeholder divs for all pages first (for scrolling)
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page placeholder';
        pageDiv.id = `page-${i}`;
        pageDiv.dataset.pageNumber = i;
        pageDiv.style.width = '612px'; // Default letter size
        pageDiv.style.height = '792px';
        pageDiv.innerHTML = `<div class="page-loading">Page ${i}</div>`;
        pdfContainer.appendChild(pageDiv);
    }
    
    // Render first 3 pages immediately and extract their text
    const initialPages = Math.min(3, pdfDoc.numPages);
    for (let i = 1; i <= initialPages; i++) {
        await renderPage(i);
    }
    
    // Sort words after initial pages rendered
    sortWordsByReadingOrder();
    detectParagraphs();
    
    // Setup lazy loading for remaining pages
    setupLazyLoading();
    
    // Extract remaining text in background (non-blocking)
    if (totalPages > initialPages) {
        setTimeout(() => extractRemainingText(initialPages + 1), 100);
    }
}

// Extract text from remaining pages incrementally (non-blocking)
async function extractRemainingText(startPage) {
    for (let i = startPage; i <= pdfDoc.numPages; i++) {
        // Check if page already rendered (has words extracted)
        const pageDiv = document.getElementById(`page-${i}`);
        if (pageDiv && !pageDiv.classList.contains('placeholder')) continue;
        
        try {
            await extractTextFromPage(i);
            
            // Yield to UI every 5 pages
            if (i % 5 === 0) {
                sortWordsByReadingOrder();
                detectParagraphs();
                await new Promise(r => setTimeout(r, 10));
            }
        } catch (err) {
            console.warn('Error extracting text from page', i, err);
        }
    }
    
    // Final sort after all extraction
    sortWordsByReadingOrder();
    detectParagraphs();
    console.log("Flow Mate: Text extraction complete -", allWords.length, "words");
}

// Extract text from a single page
async function extractTextFromPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: currentScale });
    const textContent = await page.getTextContent();
    
    const pageWords = [];
    
    textContent.items.forEach((item) => {
        const itemText = item.str;
        if (!itemText.trim()) return;
        
        const tx = item.transform[4];
        const ty = item.transform[5];
        const fontSize = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
        const [viewX, viewY] = viewport.convertToViewportPoint(tx, ty);
        const itemHeight = fontSize * currentScale;
        const charWidth = (item.width / Math.max(1, itemText.length)) * currentScale;
        
        const wordsInItem = itemText.split(/(\s+)/);
        let charOffset = 0;
        
        wordsInItem.forEach(part => {
            if (/\S/.test(part)) {
                pageWords.push({
                    word: part,
                    page: pageNum,
                    x: viewX + charOffset * charWidth,
                    y: viewY - itemHeight,
                    width: part.length * charWidth,
                    height: itemHeight
                });
            }
            charOffset += part.length;
        });
    });
    
    // Sort page words by reading order (top to bottom, left to right)
    pageWords.sort((a, b) => {
        // Group by approximate line (within half line height)
        const lineTolerance = (a.height + b.height) / 4;
        if (Math.abs(a.y - b.y) < lineTolerance) {
            return a.x - b.x; // Same line: left to right
        }
        return a.y - b.y; // Different lines: top to bottom
    });
    
    allWords.push(...pageWords);
}

// Sort all words by page, then reading order
function sortWordsByReadingOrder() {
    allWords.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        
        // Group by approximate line
        const lineTolerance = (a.height + b.height) / 4;
        if (Math.abs(a.y - b.y) < lineTolerance) {
            return a.x - b.x; // Same line: left to right
        }
        return a.y - b.y; // Different lines: top to bottom
    });
}

// Lazy load pages as they come into view
function setupLazyLoading() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageDiv = entry.target;
                const pageNum = parseInt(pageDiv.dataset.pageNumber);
                if (pageDiv.classList.contains('placeholder')) {
                    renderPage(pageNum);
                }
            }
        });
    }, { 
        root: pdfContainer,
        rootMargin: '200px',
        threshold: 0.1
    });
    
    document.querySelectorAll('.pdf-page').forEach(page => {
        observer.observe(page);
    });
}

// ========== PAGE RENDERING ==========
async function renderPage(num) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: currentScale });
    const pageWords = []; // Collect words for this page

    // Check if placeholder exists
    let pageDiv = document.getElementById(`page-${num}`);
    const isReplacing = pageDiv && pageDiv.classList.contains('placeholder');
    
    if (isReplacing) {
        // Replace placeholder content
        pageDiv.innerHTML = '';
        pageDiv.classList.remove('placeholder');
        pageDiv.style.width = `${viewport.width}px`;
        pageDiv.style.height = `${viewport.height}px`;
    } else if (!pageDiv) {
        // Create new page div
        pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        pageDiv.style.width = `${viewport.width}px`;
        pageDiv.style.height = `${viewport.height}px`;
        pageDiv.dataset.pageNumber = num;
        pageDiv.id = `page-${num}`;
        pdfContainer.appendChild(pageDiv);
    } else {
        // Already rendered, skip
        return;
    }

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pageDiv.appendChild(canvas);

    await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
    }).promise;

    // Text layer
    const textContent = await page.getTextContent();
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer';
    if (textSelectionMode) textLayerDiv.classList.add('selectable');
    pageDiv.appendChild(textLayerDiv);
    
    // Process text items
    textContent.items.forEach((item) => {
        const itemText = item.str;
        if (!itemText.trim()) return;
        
        const tx = item.transform[4];
        const ty = item.transform[5];
        const fontSize = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
        const [viewX, viewY] = viewport.convertToViewportPoint(tx, ty);
        const itemHeight = fontSize * currentScale;
        
        // Text span for selection
        const textSpan = document.createElement('span');
        textSpan.textContent = itemText;
        textSpan.style.left = `${viewX}px`;
        textSpan.style.top = `${viewY - itemHeight}px`;
        textSpan.style.fontSize = `${itemHeight}px`;
        textSpan.style.fontFamily = item.fontName || 'sans-serif';
        textLayerDiv.appendChild(textSpan);
        
        // Word extraction - only add if not already extracted
        if (!isReplacing) {
            const charWidth = (item.width / Math.max(1, itemText.length)) * currentScale;
            const wordsInItem = itemText.split(/(\s+)/);
            let charOffset = 0;
            
            wordsInItem.forEach(segment => {
                const word = segment.trim();
                if (word) {
                    pageWords.push({
                        word: word,
                        page: num,
                        x: viewX + (charOffset * charWidth),
                        y: viewY - itemHeight,
                        width: word.length * charWidth,
                        height: itemHeight * 1.2
                    });
                }
                charOffset += segment.length;
            });
        }
    });
    
    // Sort and add words from this page in reading order
    if (!isReplacing && pageWords.length > 0) {
        pageWords.sort((a, b) => {
            const lineTolerance = (a.height + b.height) / 4;
            if (Math.abs(a.y - b.y) < lineTolerance) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });
        allWords.push(...pageWords);
    }
}

// ========== PARAGRAPH DETECTION ==========
function detectParagraphs() {
    paragraphStarts = [0];
    if (allWords.length < 2) return;
    
    let lastPage = allWords[0].page;
    let lastY = allWords[0].y;
    let lastHeight = allWords[0].height;
    
    for (let i = 1; i < allWords.length; i++) {
        const word = allWords[i];
        
        // New page = new paragraph
        if (word.page !== lastPage) {
            if (!paragraphStarts.includes(i)) paragraphStarts.push(i);
            lastPage = word.page;
            lastY = word.y;
            lastHeight = word.height;
            continue;
        }
        
        // Large Y jump = new paragraph
        if (word.y - lastY > lastHeight * 1.5) {
            if (!paragraphStarts.includes(i)) paragraphStarts.push(i);
        }
        
        lastY = word.y;
        lastHeight = word.height;
    }
    
    paragraphStarts.sort((a, b) => a - b);
}

// ========== MESSAGE HANDLING ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Flow Mate Viewer: Message received:", request.action);
    
    if (request.action === "getContent") {
        if (!pdfLoaded || allWords.length === 0) {
            sendResponse({ content: null, error: "No PDF loaded" });
        } else {
            sendResponse({ 
                content: allWords.map(w => w.word).join(' '),
                paragraphStarts: paragraphStarts
            });
        }
        return true;
    }
    
    if (request.action === "getClickedWordIndex") {
        sendResponse({ wordIndex: lastClickedWordIndex });
        return true;
    }
    
    if (request.action === "resetHighlightPosition") {
        lastClickedWordIndex = -1;
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "highlight") {
        highlightWordsInPdf(request.index, request.wordCount || 1);
        return false;
    }
    
    if (request.action === "clearHighlight") {
        clearHighlights();
        return false;
    }
    
    return false;
});

// ========== HIGHLIGHTING ==========
function highlightWordsInPdf(startIndex, wordCount = 1) {
    clearHighlights();
    
    if (startIndex < 0 || startIndex >= allWords.length) return;
    
    const endIndex = Math.min(startIndex + wordCount - 1, allWords.length - 1);
    const firstWord = allWords[startIndex];
    
    // Update page display
    if (firstWord.page !== currentPage) {
        currentPage = firstWord.page;
        pageInput.value = currentPage;
        updateNavButtons();
    }
    
    // Group by page
    const wordsByPage = {};
    for (let i = startIndex; i <= endIndex; i++) {
        const word = allWords[i];
        if (!wordsByPage[word.page]) wordsByPage[word.page] = [];
        wordsByPage[word.page].push(word);
    }
    
    // Render highlights
    Object.entries(wordsByPage).forEach(([pageNum, words]) => {
        const pageDiv = document.getElementById(`page-${pageNum}`);
        if (!pageDiv) return;
        
        if (parseInt(pageNum) === firstWord.page) {
            pageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        words.forEach(word => {
            const highlight = document.createElement('div');
            highlight.className = 'flowmate-pdf-highlight';
            highlight.style.left = `${word.x - 3}px`;
            highlight.style.top = `${word.y - 3}px`;
            highlight.style.width = `${word.width + 6}px`;
            highlight.style.height = `${word.height + 6}px`;
            pageDiv.appendChild(highlight);
        });
    });
}

function clearHighlights() {
    document.querySelectorAll('.flowmate-pdf-highlight').forEach(h => h.remove());
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
    } else if (e.key === 'Home') {
        e.preventDefault();
        goToPage(1);
    } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(totalPages);
    } else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        zoomInBtn.click();
    } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOutBtn.click();
    }
});
