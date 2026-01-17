import * as pdfjsLib from 'pdfjs-dist';
// Explicitly set worker source for webpack
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; 
// Ideally bundle the worker, but for quick scaffolding this CDN link avoids complex worker-loader config in webpack 5

const fileInput = document.getElementById('fileInput');
const pdfContainer = document.getElementById('pdfContainer');
const pageNumSpan = document.getElementById('pageNum');
const pageCountSpan = document.getElementById('pageCount');

let pdfDoc = null;
let allWords = []; // Flat list of all words with location info

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const arrayBuffer = await file.arrayBuffer();
        loadPdf(arrayBuffer);
    }
});

async function loadPdf(data) {
    pdfContainer.innerHTML = ''; // Clear previous
    allWords = []; 
    
    try {
        pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        pageCountSpan.innerText = pdfDoc.numPages;
        
        let globalWordIndex = 0;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            await renderPage(i);
        }
        
        console.log("PDF Loaded with " + allWords.length + " words.");
    } catch (err) {
        console.error("Error loading PDF: ", err);
    }
}

async function renderPage(num) {
    const page = await pdfDoc.getPage(num);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
    pageDiv.style.position = 'relative'; // Ensure absolute children are relative to this
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

    // Text Layer
    const textContent = await page.getTextContent();
    
    // Process items to words
    // CAUTION: This is a simplified tokenizer. PDF items can be "Hel" "lo".
    // For this MVP, we assume items are roughly words or headers. 
    // A proper PDF text extraction requires checking distances between items.
    
    // We will just join all items into a big string, split by space, and try to map back?
    // Mapping back is hard. 
    // Let's assume each item is a word or phrase and split it.
    
    textContent.items.forEach((item) => {
        const itemText = item.str;
        if (!itemText.trim()) return;
        
        const wordsInItem = itemText.split(/\s+/);
        
        // We need to estimate rect for each word in the item. 
        // This is complex. For now, we map the WHOLE item to these words.
        // Or just map the first word to the start, and others loosely.
        
        wordsInItem.forEach(w => {
            if(w.trim()) {
                 allWords.push({
                    word: w,
                    page: num,
                    // We store the whole item rect/transform as approximation
                    // transform: [scaleX, skewY, skewX, scaleY, tx, ty]
                    // PDF coordinates need to be converted to viewport
                    transform: item.transform,
                    width: item.width,
                    height: item.height 
                });
            }
        });
    });
}



// Global function to get content (called by content script / message listener)
// Since this is a page inside the extension, it acts as a "content script" candidate if we have the right permissions
// But essentially we treat this page like any other page.
// The content script `content.js` will inject into this page if it matches <all_urls>?
// No, extension pages usually don't run content scripts. 
// We need to implement the message listener explicitly here.

// Communication with Side Panel
// Extension pages (like this viewer) share the runtime with the background/sidepanel.
// We can listen to runtime messages directly.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getContent") {
        const fullText = allWords.map(w => w.word).join(' ');
        sendResponse({ content: fullText });
    } else if (request.action === "highlight") {
         // Get the text to highlight
         const text = request.text;
         if (text) {
             highlightTextInPdf(text, request.index);
         }
    } else if (request.action === "clearHighlight") {
        clearHighlights();
    }
});

function highlightTextInPdf(searchText, wordIndex) {
    if (!searchText) return;
    
    // Clear previous
    clearHighlights();

    // Find which page contains this word index
    let targetPage = 1;
    if (wordIndex >= 0 && wordIndex < allWords.length) {
        targetPage = allWords[wordIndex].page;
    } else {
        // Try to find by text
        const foundWord = allWords.find(w => searchText.includes(w.word));
        if (foundWord) {
            targetPage = foundWord.page;
        }
    }

    // Find the page div
    const pageDiv = document.getElementById(`page-${targetPage}`);
    if (!pageDiv) return;
    
    // Scroll page into view
    pageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Create highlight overlay on the page
    const highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'focus-read-pdf-highlight';
    highlightOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border: 4px solid #e74c3c;
        border-radius: 8px;
        pointer-events: none;
        z-index: 1000;
        box-shadow: inset 0 0 30px rgba(231, 76, 60, 0.15);
    `;
    pageDiv.appendChild(highlightOverlay);
    
    // Also add a subtle glow
    pageDiv.style.boxShadow = "0 0 20px rgba(231, 76, 60, 0.6)";

    console.log(`Highlighting on Page ${targetPage}: ${searchText}`);
}

function highlightWord(wordData) {
    if (!wordData) return;
    highlightTextInPdf(wordData.word, allWords.indexOf(wordData));
}

function clearHighlights() {
    // Remove overlay elements
    const overlays = document.querySelectorAll('.focus-read-pdf-highlight');
    overlays.forEach(o => o.remove());
    
    // Reset page shadows
    const pages = document.querySelectorAll('.pdf-page');
    pages.forEach(p => p.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)');
}
