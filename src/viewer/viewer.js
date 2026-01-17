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
    // Check if message is intended for us (the viewer)
    // We can filter by action or if we are the active tab.
    // Sidepanel will send "getContent" to the active tab. 
    // If we are the active tab, we should respond.
    
    if (request.action === "getContent") {
        const fullText = allWords.map(w => w.word).join(' ');
        sendResponse({ content: fullText });
    } else if (request.action === "highlight") {
         const index = request.index;
         if (index >= 0 && index < allWords.length) {
             const wordData = allWords[index];
             highlightWord(wordData);
         }
    }
});

function highlightWord(wordData) {
    if (!wordData) return;
    
    // Clear previous
    clearHighlights();

    // Find the page div
    const pageDiv = document.getElementById(`page-${wordData.page}`);
    if (!pageDiv) return;
    
    // Scroll into view
    pageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Create highlight element
    // Note: We need accurate coordinates. Using transform directly is hard without matrix math.
    // Simplifying: accessing the textLayer's span could be easier if we linked them.
    // But we didn't link 'allWords' to DOM elements.
    
    // Alternative: Just approximate using the page number to scroll for now.
    // Precise highlighting requires bridging the gap between 'allWords' (logic) and DOM.
    // Since we used pdfjsLib.renderTextLayer, spans exist.
    // But we don't know WHICH span corresponds to our word easily without tracking.
    
    // Fallback: visual indication on the page container?
    // Let's create a generic highlight box in the center of the page as a placeholder
    // acknowledging "User is on Page X".
    
    // BETTER: Use pdfjsLib's viewport converter if we can re-create it.
    // const scale = 1.5;
    // const viewport = pageDiv.dataset.viewport... (we didn't store it)
    
    const hl = document.createElement('div');
    hl.className = 'highlight';
    hl.style.left = '0';
    hl.style.right = '0';
    hl.style.top = '0'; // Placeholder
    hl.style.height = '20px';
    // pageDiv.appendChild(hl);
    
    // For MVP, just scrolling the page into view is a huge win.
    
    // Create a temporary visual highlight on the page container
    // This is better than nothing.
    const highlightBox = document.createElement('div');
    highlightBox.className = 'highlight-box';
    highlightBox.style.position = 'absolute';
    highlightBox.style.border = '3px solid red';
    highlightBox.style.zIndex = '1000';
    highlightBox.style.pointerEvents = 'none';
    
    // Approximate location? We have transform [a, b, c, d, x, y]
    // x, y are in PDF points.
    // viewport.convertToViewportPoint(x, y) gives logical pixels.
    // We need to re-get viewport.
    
    // HACK: Re-calculate viewport for the page
    // We know scale is 1.5, we assume it hasn't changed (no zoom support yet)
    
    // Better: Just highlight the whole page for now as "Current Page"
    pageDiv.style.boxShadow = "0 0 0 5px rgba(231, 76, 60, 0.5)";
    setTimeout(() => {
        pageDiv.style.boxShadow = ""; // clear after a bit or stick? Stick is better for "tracking"
        // But we clearHighlights() at start of function, so it moves.
    }, 1500);

    console.log(`Highlighting word on Page ${wordData.page}: ${wordData.word}`);
}

function clearHighlights() {
    const pages = document.querySelectorAll('.pdf-page');
    pages.forEach(p => p.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)');
}
