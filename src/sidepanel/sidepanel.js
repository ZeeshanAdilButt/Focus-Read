document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const wordDisplay = document.getElementById('wordDisplay');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const restartBtn = document.getElementById('restartBtn');
    const wpmInput = document.getElementById('wpmInput');
    const wpmDisplay = document.getElementById('wpmDisplay');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const timeRemaining = document.getElementById('timeRemaining');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const chunkSizeInput = document.getElementById('chunkSizeInput');
    const scanPageBtn = document.getElementById('scanPageBtn');
    const openPdfBtn = document.getElementById('openPdfBtn');
    const setTextBtn = document.getElementById('setTextBtn');
    const clearTextBtn = document.getElementById('clearTextBtn');
    const manualInputOverlay = document.getElementById('manualInputOverlay');
    const manualTextInput = document.getElementById('manualTextInput');
    const loadInputBtn = document.getElementById('loadInputBtn');
    const cancelInputBtn = document.getElementById('cancelInputBtn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const readerDisplay = document.getElementById('readerDisplay');

    // Settings UI Elements
    const togglePausesBtn = document.getElementById('togglePausesBtn');
    const toggleLoopBtn = document.getElementById('toggleLoopBtn');
    const pauseScaleSlider = document.getElementById('pauseScaleSlider');
    const pauseScaleInput = document.getElementById('pauseScaleInput');
    const fontSelect = document.getElementById('fontSelect');
    const fontScaleSlider = document.getElementById('fontScaleSlider');
    const fontScaleInput = document.getElementById('fontScaleInput');
    const bgColorPicker = document.getElementById('bgColorPicker');
    const bgColorText = document.getElementById('bgColorText');
    const textColorPicker = document.getElementById('textColorPicker');
    const textColorText = document.getElementById('textColorText');
    const focusColorPicker = document.getElementById('focusColorPicker');
    const focusColorText = document.getElementById('focusColorText');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const navModeSelect = document.getElementById('navModeSelect');
    const navAmountInput = document.getElementById('navAmountInput');

    // State
    let words = [];
    let currentIndex = 0;
    let isPlaying = false;
    let timer = null; // Used for "next step" timeout
    
    // Config
    let config = {
        wpm: 300,
        chunkSize: 1,
        mode: 'word', // 'word' or 'sentence'
        pauses: true,
        loop: false,
        pauseScale: 1.5,
        font: "'Segoe UI', sans-serif",
        fontScale: 1,
        bgColor: '#000000',
        textColor: '#ffffff',
        focusColor: '#e74c3c',
        navMode: 'paragraphs', // 'seconds', 'words', 'sentences', 'paragraphs'
        navAmount: 1
    };

    // Toast notification helper
    function showToast(message, duration = 2500) {
        if (!toast || !toastMessage) return;
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        // Force reflow before adding show class
        toast.offsetHeight;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }

    // UI Elements for Mode
    const modeWordBtn = document.getElementById('modeWordBtn');
    const modeSentenceBtn = document.getElementById('modeSentenceBtn');
    const chunkSizeContainer = document.getElementById('chunkSizeContainer');
    const sentenceLengthContainer = document.getElementById('sentenceLengthContainer');

    // --- ORP Logic (Optimal Recognition Point) ---
    function formatWord(word) {
        if (!word) return "&nbsp;";
        // Clean the word of extra whitespace
        word = word.trim();
        if (!word) return "&nbsp;";
        
        // Calculate ORP (Optimal Recognition Point) - typically around 1/3 into the word
        // For short words (1-3 chars), highlight first char
        // For medium words (4-7 chars), highlight ~25-35% position
        // For long words (8+), highlight ~30% position
        let idx;
        const len = word.length;
        if (len <= 1) {
            idx = 0;
        } else if (len <= 3) {
            idx = 0; // First letter for short words
        } else if (len <= 7) {
            idx = Math.floor(len * 0.3); // ~30% for medium
        } else {
            idx = Math.floor(len * 0.28); // ~28% for long words
        }
        
        const start = word.slice(0, idx);
        const char = word.slice(idx, idx + 1);
        const end = word.slice(idx + 1);
        
        return `${start}<span class="highlight-char" style="color: ${config.focusColor}">${char}</span>${end}`;
    }
    
    // Format multiple words with ORP on each
    function formatChunk(text) {
        if (!text) return "&nbsp;";
        const words = text.trim().split(/\s+/);
        return words.map(w => formatWord(w)).join(' ');
    }

    // --- Core Reader Logic ---

    // Calculate base interval (ms per word/chunk)
    function getIntervalForChunk(chunkText, isSentence) {
        // Base calculation: ms per word = 60000 / WPM
        const msPerWord = 60000 / config.wpm;
        
        if (isSentence && chunkText) {
            // For sentences, count actual words
            const wordCount = chunkText.trim().split(/\s+/).length;
            return msPerWord * wordCount;
        } else {
            // For word mode, multiply by chunk size
            return msPerWord * config.chunkSize;
        }
    }

    function updateDisplay() {
        // Apply styles
        document.body.style.backgroundColor = config.bgColor;
        wordDisplay.style.color = config.textColor;
        wordDisplay.style.fontFamily = config.font;
        
        // Adjust font size based on mode and chunk size
        let baseSize = 3; // Default for single word
        if (config.mode === 'sentence') {
            baseSize = 1.5;
        } else if (config.chunkSize > 1) {
            // Scale down for multiple words: 2 words = 2.5rem, 3 words = 2rem, etc.
            baseSize = Math.max(1.5, 3 - (config.chunkSize - 1) * 0.5);
        }
        wordDisplay.style.fontSize = `${baseSize * config.fontScale}rem`;
        
        // Enable wrapping for multi-word or sentence mode
        wordDisplay.style.whiteSpace = (config.mode === 'sentence' || config.chunkSize > 1) ? 'normal' : 'nowrap';
        // ... (other UI color sync)

        if (words.length === 0) {
            wordDisplay.innerHTML = '<span class="placeholder">Ready to flow</span>';
            return;
        }

        let chunk = "";
        let nextIndexChange = 0;

        // Logic to get the current chunk based on mode
        if (config.mode === 'sentence') {
             // Find end of sentence from currentIndex
             let tempIndex = currentIndex;
             let collected = [];
             
             while (tempIndex < words.length) {
                 const w = words[tempIndex];
                 collected.push(w);
                 // Check for sentence ending punctuation
                 if (/[.?!]$/.test(w)) {
                     break; 
                 }
                 // Safety cap for extremely long sentences without punctuation (programming code etc)
                 if (collected.length > 30) break; 
                 tempIndex++;
             }
             chunk = collected.join(' ');
             nextIndexChange = collected.length; // How many words we consumed
        } else {
            // Word mode
            chunk = words.slice(currentIndex, currentIndex + config.chunkSize).join(' ');
            nextIndexChange = config.chunkSize;
        }
        
        // Handle end of text
        if (!chunk) {
            if (config.loop) {
                currentIndex = 0; 
                // Recurse to get first chunk
                updateDisplay();
                return;
            } else {
                pause();
                currentIndex = 0; 
                return;
            }
        }
        
        // Apply ORP formatting to all words
        if (config.mode === 'sentence') {
            // For sentences, format each word with ORP
            wordDisplay.innerHTML = formatChunk(chunk);
        } else if (config.chunkSize === 1) {
            wordDisplay.innerHTML = formatWord(chunk);
        } else {
            // Multi-word chunk - format each word
            wordDisplay.innerHTML = formatChunk(chunk);
        }

        return { chunk, nextIndexChange };
    }
    
    function updateProgress() {
        if (words.length === 0) return;
        
        progressBar.max = words.length; 
        progressBar.value = currentIndex;
        
        const percent = Math.round((currentIndex / words.length) * 100) || 0;
        progressText.innerText = `${percent}%`;
        
        const wordsLeft = words.length - currentIndex;
        const minutesLeft = wordsLeft / config.wpm;
        const mins = Math.floor(minutesLeft);
        const secs = Math.ceil((minutesLeft - mins) * 60);
        timeRemaining.innerText = (mins > 0 ? `${mins}m ` : "") + `${secs}s`;
    }

    let lastStepDelta = 1;

    function scheduleNextStep(currentChunkText) {
        if (!isPlaying) return;

        // Base delay from WPM
        let delay = getIntervalForChunk(currentChunkText, config.mode === 'sentence');
        
        // Apply pause scaling for punctuation
        if (config.pauses && currentChunkText) {
            const trimmedText = currentChunkText.trim();
            const lastChar = trimmedText.slice(-1);
            
            // Strong pause for sentence-ending punctuation
            if (['.', '!', '?'].includes(lastChar)) {
                delay = delay * config.pauseScale;
            } 
            // Medium pause for semicolons and colons
            else if ([';', ':'].includes(lastChar)) {
                delay = delay * (1 + (config.pauseScale - 1) * 0.7);
            }
            // Light pause for commas
            else if ([','].includes(lastChar)) {
                delay = delay * (1 + (config.pauseScale - 1) * 0.4);
            }
        }

        timer = setTimeout(() => {
            step();
        }, delay);
    }

    function step() {
        if (!isPlaying) return;
        
        // Advance by the amount determined in the PREVIOUS display update
        currentIndex += lastStepDelta;
        
        if (currentIndex >= words.length && !config.loop) {
            pause();
            currentIndex = 0;
            updateDisplay();
            return;
        }
        
        if (currentIndex >= words.length && config.loop) {
            currentIndex = 0;
        }

        const { chunk, nextIndexChange } = updateDisplay();
        lastStepDelta = nextIndexChange; // Store for next advance
        
        // Broadcast highlight to document
        broadcastHighlight();

        updateProgress();
        scheduleNextStep(chunk);
    }

    function play() {
        if (words.length === 0) return;
        isPlaying = true;
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        
        // Update fullscreen button if active
        const fsPlayBtn = document.getElementById('fsPlayPause');
        if (fsPlayBtn) fsPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
        
        // Display CURRENT index immediately
        const { chunk, nextIndexChange } = updateDisplay();
        lastStepDelta = nextIndexChange;
        
        // Initial broadcast
        broadcastHighlight();
        
        scheduleNextStep(chunk);
    }

    function pause() {
        isPlaying = false;
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        // Keep highlight visible when paused - don't clear it
    }

    function loadText(text, indexToStart = 0) {
        if (!text) return;
        // Stop any current playback
        pause();
        // Clear and load new text
        words = text.trim().split(/\s+/);
        currentIndex = indexToStart;
        lastStepDelta = 1;
        updateDisplay();
        updateProgress();
        // Highlight in original document
        broadcastHighlight();
    }

    function clearText() {
        pause();
        words = [];
        currentIndex = 0;
        lastStepDelta = 1;
        wordDisplay.innerHTML = '<span class="placeholder">Ready to flow</span>';
        progressBar.value = 0;
        progressText.innerText = '0%';
        timeRemaining.innerText = '--:--';
        // Clear highlight in document
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) { 
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "clearHighlight"
                }).catch(() => {});
            }
        });
    }

    function broadcastHighlight() {
        if (words.length === 0) return;
        
        // Get the current chunk being displayed
        let chunkText = '';
        let contextBefore = '';
        let contextAfter = '';
        let wordCount = 1;
        
        if (config.mode === 'sentence') {
            let tempIndex = currentIndex;
            let collected = [];
            while (tempIndex < words.length) {
                const w = words[tempIndex];
                collected.push(w);
                if (/[.?!]$/.test(w)) break;
                if (collected.length > 30) break;
                tempIndex++;
            }
            chunkText = collected.join(' ');
            wordCount = collected.length;
        } else {
            chunkText = words.slice(currentIndex, currentIndex + config.chunkSize).join(' ');
            wordCount = config.chunkSize;
        }
        
        // Get surrounding context for more accurate highlighting (5 words before and after)
        const contextStart = Math.max(0, currentIndex - 5);
        const contextEnd = Math.min(words.length, currentIndex + config.chunkSize + 5);
        contextBefore = words.slice(contextStart, currentIndex).join(' ');
        contextAfter = words.slice(currentIndex + config.chunkSize, contextEnd).join(' ');
        
        const highlightMsg = {
            action: "highlight", 
            index: currentIndex,
            text: chunkText,
            wordCount: wordCount,
            contextBefore: contextBefore,
            contextAfter: contextAfter,
            mode: config.mode
        };
        
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                // Check if it's an extension page (PDF viewer)
                const isExtensionPage = tabs[0].url && tabs[0].url.startsWith('chrome-extension://');
                
                if (isExtensionPage) {
                    // Send via runtime for extension pages
                    chrome.runtime.sendMessage(highlightMsg).catch(() => {});
                } else {
                    // Send via tabs for regular pages  
                    chrome.tabs.sendMessage(tabs[0].id, highlightMsg).catch(() => {});
                }
            }
        });
    }

    // Apply UI from Config
    function syncSettingsUI() {
        // Mode UI
        if (config.mode === 'sentence') {
            modeWordBtn.classList.remove('active');
            modeSentenceBtn.classList.add('active');
            chunkSizeContainer.classList.add('hidden');
        } else {
            modeWordBtn.classList.add('active');
            modeSentenceBtn.classList.remove('active');
            chunkSizeContainer.classList.remove('hidden');
        }

        wpmInput.value = config.wpm;
        wpmDisplay.innerText = config.wpm;
        chunkSizeInput.value = config.chunkSize;
        
        togglePausesBtn.classList.toggle('active', config.pauses);
        togglePausesBtn.innerText = config.pauses ? "Pauses: On" : "Pauses: Off";
        
        toggleLoopBtn.classList.toggle('active', config.loop);
        toggleLoopBtn.innerText = config.loop ? "Loop: On" : "Loop: Off";
        
        pauseScaleSlider.value = config.pauseScale;
        pauseScaleInput.value = config.pauseScale;
        
        fontSelect.value = config.font;
        
        fontScaleSlider.value = config.fontScale;
        fontScaleInput.value = config.fontScale;
        
        bgColorPicker.value = config.bgColor;
        bgColorText.value = config.bgColor;
        
        textColorPicker.value = config.textColor;
        textColorText.value = config.textColor;
        
        focusColorPicker.value = config.focusColor;
        focusColorText.value = config.focusColor;
        
        // Navigation settings
        navModeSelect.value = config.navMode;
        navAmountInput.value = config.navAmount;
        updateNavTooltips();

        updateDisplay(); // Force refresh styles
    }

    // --- Event Listeners ---
    
    // Mode Switching
    modeWordBtn.addEventListener('click', () => {
        config.mode = 'word';
        syncSettingsUI();
    });

    modeSentenceBtn.addEventListener('click', () => {
        config.mode = 'sentence';
        syncSettingsUI();
    });

    // Toggle Buttons
    togglePausesBtn.addEventListener('click', () => {
        config.pauses = !config.pauses;
        syncSettingsUI();
    });

    toggleLoopBtn.addEventListener('click', () => {
        config.loop = !config.loop;
        syncSettingsUI();
    });

    // Inputs Sync (Slider <-> Box)
    pauseScaleSlider.addEventListener('input', (e) => {
        config.pauseScale = parseFloat(e.target.value);
        syncSettingsUI();
    });
    pauseScaleInput.addEventListener('change', (e) => {
        config.pauseScale = parseFloat(e.target.value);
        syncSettingsUI();
    });

    fontScaleSlider.addEventListener('input', (e) => {
        config.fontScale = parseFloat(e.target.value);
        syncSettingsUI();
    });
    fontScaleInput.addEventListener('change', (e) => {
        config.fontScale = parseFloat(e.target.value);
        syncSettingsUI();
    });

    // General Inputs
    chunkSizeInput.addEventListener('change', (e) => {
        config.chunkSize = parseInt(e.target.value) || 1;
        syncSettingsUI();
    });

    fontSelect.addEventListener('change', (e) => {
        config.font = e.target.value;
        syncSettingsUI();
    });

    // Color Pickers
    function updateColor(key, value) {
        config[key] = value;
        syncSettingsUI();
    }

    bgColorPicker.addEventListener('input', (e) => updateColor('bgColor', e.target.value));
    bgColorText.addEventListener('change', (e) => updateColor('bgColor', e.target.value));
    
    textColorPicker.addEventListener('input', (e) => updateColor('textColor', e.target.value));
    textColorText.addEventListener('change', (e) => updateColor('textColor', e.target.value));
    
    focusColorPicker.addEventListener('input', (e) => updateColor('focusColor', e.target.value));
    focusColorText.addEventListener('change', (e) => updateColor('focusColor', e.target.value));

    // Reset
    resetSettingsBtn.addEventListener('click', () => {
        config = {
            wpm: 300,
            chunkSize: 1,
            mode: 'word',
            pauses: true,
            loop: false,
            pauseScale: 1.5,
            font: "'Segoe UI', sans-serif",
            fontScale: 1,
            bgColor: '#000000',
            textColor: '#ffffff',
            focusColor: '#e74c3c',
            navMode: 'paragraphs',
            navAmount: 1
        };
        syncSettingsUI();
    });

    // Navigation settings listeners
    navModeSelect.addEventListener('change', (e) => {
        config.navMode = e.target.value;
        updateNavTooltips();
    });
    
    navAmountInput.addEventListener('change', (e) => {
        config.navAmount = parseInt(e.target.value) || 1;
    });
    
    function updateNavTooltips() {
        const modeLabels = {
            'seconds': `${config.navAmount}s`,
            'words': `${config.navAmount} words`,
            'sentences': `${config.navAmount} sentence${config.navAmount > 1 ? 's' : ''}`,
            'paragraphs': `${config.navAmount} para${config.navAmount > 1 ? 's' : ''}`
        };
        prevBtn.title = `Back ${modeLabels[config.navMode]}`;
        nextBtn.title = `Forward ${modeLabels[config.navMode]}`;
    }
    updateNavTooltips(); // Initialize

    // 1. Auto-load from active tab on open
    async function fetchPageContent() {
         // Clear existing content first
         clearText();
         
         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
         if (tab) {
             const url = tab.url || '';
             
             // Check if it's a PDF URL (browser's built-in PDF viewer)
             const isPdfUrl = url.toLowerCase().endsWith('.pdf') || 
                              url.includes('blob:') ||
                              url.includes('/pdf/') ||
                              (tab.title && tab.title.endsWith('.pdf'));
             
             // Check if it's our PDF viewer (extension page)
             const isOurViewer = url.startsWith('chrome-extension://') && url.includes('viewer.html');
             const isExtensionPage = url.startsWith('chrome-extension://');
             
             if (isPdfUrl && !isOurViewer) {
                 // Show message to use our PDF viewer
                 wordDisplay.innerHTML = '<span class="placeholder">Use PDF button →</span>';
                 return;
             }
             
             if (isOurViewer || isExtensionPage) {
                 // Use runtime message for extension pages
                 chrome.runtime.sendMessage({ action: "getContent" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Could not get content from extension page:", chrome.runtime.lastError.message);
                        wordDisplay.innerHTML = '<span class=\"placeholder\">Click Read Page after loading PDF</span>';
                    } else if (response && response.content) {
                        loadText(response.content);
                    } else if (response && response.error) {
                        console.log("PDF not ready:", response.error);
                        wordDisplay.innerHTML = '<span class=\"placeholder\">Load a PDF file first</span>';
                    } else {
                        wordDisplay.innerHTML = '<span class=\"placeholder\">Load a PDF file first</span>';
                    }
                 });
             } else {
                 // Regular web page - use tabs message
                 chrome.tabs.sendMessage(tab.id, { action: "getContent" }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Script likely not injected in this tab (e.g. chrome:// URL or restricted)
                        console.log("Could not auto-load content:", chrome.runtime.lastError.message);
                        wordDisplay.innerHTML = '<span class="placeholder">Reload page</span>';
                    } else if (response && response.content) {
                        // Store paragraph boundaries if provided
                        if (response.paragraphStarts) {
                            storedParagraphStarts = response.paragraphStarts;
                        }
                        loadText(response.content);
                    } else {
                         wordDisplay.innerHTML = '<span class="placeholder">No text found</span>';
                    }
                 });
             }
         }
    }

    fetchPageContent(); // Run on load

    scanPageBtn.addEventListener('click', () => {
        fetchPageContent();
    });
    
    // Open PDF Viewer Button
    openPdfBtn.addEventListener('click', () => {
        // Open the PDF viewer in a new tab
        const viewerUrl = chrome.runtime.getURL('viewer.html');
        chrome.tabs.create({ url: viewerUrl });
    });
    
    // Clear Button
    clearTextBtn.addEventListener('click', () => {
        clearText();
    });

    // 2. Play/Pause
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) pause();
        else play();
    });

    // 3. Navigation
    // Store paragraph starts from content script
    let storedParagraphStarts = [0];
    
    function calculateNavJump(direction) {
        let jump = 0;
        
        switch (config.navMode) {
            case 'seconds':
                // Convert seconds to words: words = (wpm / 60) * seconds
                jump = Math.round((config.wpm / 60) * config.navAmount);
                break;
            case 'words':
                jump = config.navAmount;
                break;
            case 'sentences':
                // Find next/prev sentence boundary
                let count = 0;
                let idx = currentIndex;
                if (direction > 0) {
                    while (idx < words.length && count < config.navAmount) {
                        if (/[.?!]$/.test(words[idx])) count++;
                        idx++;
                    }
                    jump = idx - currentIndex;
                } else {
                    idx = Math.max(0, currentIndex - 1);
                    while (idx > 0 && count < config.navAmount) {
                        idx--;
                        if (/[.?!]$/.test(words[idx])) count++;
                    }
                    jump = currentIndex - idx;
                }
                break;
            case 'paragraphs':
                // Use actual paragraph boundaries if available
                if (storedParagraphStarts.length > 1) {
                    if (direction > 0) {
                        // Find next paragraph start after current position
                        for (let p = 0; p < config.navAmount; p++) {
                            let nextPara = storedParagraphStarts.find(s => s > currentIndex + jump);
                            if (nextPara !== undefined) {
                                jump = nextPara - currentIndex;
                            } else {
                                // No more paragraphs, jump to end
                                jump = words.length - currentIndex;
                                break;
                            }
                        }
                    } else {
                        // Find previous paragraph start before current position
                        let currentPos = currentIndex;
                        for (let p = 0; p < config.navAmount; p++) {
                            let prevPara = [...storedParagraphStarts].reverse().find(s => s < currentPos);
                            if (prevPara !== undefined) {
                                currentPos = prevPara;
                            } else {
                                currentPos = 0;
                                break;
                            }
                        }
                        jump = currentIndex - currentPos;
                    }
                } else {
                    // Fallback: approximate paragraphs as 5 sentences
                    const sentencesPerPara = 5;
                    let pCount = 0;
                    let pIdx = currentIndex;
                    if (direction > 0) {
                        let sCount = 0;
                        while (pIdx < words.length && pCount < config.navAmount) {
                            if (/[.?!]$/.test(words[pIdx])) {
                                sCount++;
                                if (sCount >= sentencesPerPara) {
                                    pCount++;
                                    sCount = 0;
                                }
                            }
                            pIdx++;
                        }
                        jump = pIdx - currentIndex;
                    } else {
                        let sCount = 0;
                        pIdx = Math.max(0, currentIndex - 1);
                        while (pIdx > 0 && pCount < config.navAmount) {
                            pIdx--;
                            if (/[.?!]$/.test(words[pIdx])) {
                                sCount++;
                                if (sCount >= sentencesPerPara) {
                                    pCount++;
                                    sCount = 0;
                                }
                            }
                        }
                        jump = currentIndex - pIdx;
                    }
                }
                break;
        }
        
        return Math.max(1, jump); // At least 1 word
    }
    
    prevBtn.addEventListener('click', () => {
        const jump = calculateNavJump(-1);
        currentIndex = Math.max(0, currentIndex - jump);
        updateDisplay();
        updateProgress();
        broadcastHighlight();
    });

    nextBtn.addEventListener('click', () => {
        const jump = calculateNavJump(1);
        currentIndex = Math.min(words.length - 1, currentIndex + jump);
        updateDisplay();
        updateProgress();
        broadcastHighlight();
    });

    restartBtn.addEventListener('click', () => {
        pause();
        currentIndex = 0;
        updateDisplay();
        updateProgress();
    });

    // 4. Settings & Overlays
    wpmInput.addEventListener('input', (e) => {
        config.wpm = parseInt(e.target.value);
        wpmDisplay.innerText = config.wpm;
        if (isPlaying) {
             // Restart timer with new speed? 
             // With recursive setTimeout, it will auto-adjust on next step.
             // But if we want instant feedback, we might pause/play.
             // Actually, since we use recursion now, just letting it run is fine, 
             // but `scheduleNextStep` uses CURRENT wpm. So it will update after next word.
        }
    });

    settingsBtn.addEventListener('click', () => {
        // Sync UI before showing
        syncSettingsUI();
        settingsOverlay.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsOverlay.classList.add('hidden');
    });
    
    // Close settings with X button
    const closeSettingsX = document.getElementById('closeSettingsX');
    closeSettingsX.addEventListener('click', () => {
        settingsOverlay.classList.add('hidden');
    });
    
    // Fullscreen functionality - opens dedicated fullscreen page in new window
    function openFullscreenWindow() {
        if (words.length === 0) {
            // No content to show
            return;
        }
        
        // Pause current playback
        const wasPlaying = isPlaying;
        if (isPlaying) pause();
        
        // Send content to background script to open fullscreen window
        chrome.runtime.sendMessage({
            action: "openFullscreen",
            words: words,
            currentIndex: currentIndex,
            config: {
                wpm: config.wpm,
                chunkSize: config.chunkSize,
                mode: config.mode,
                pauses: config.pauses,
                pauseScale: config.pauseScale,
                focusColor: config.focusColor,
                navMode: config.navMode,
                navAmount: config.navAmount
            },
            wasPlaying: wasPlaying
        });
    }

    fullscreenBtn.addEventListener('click', openFullscreenWindow);
    
    // Listen for sync messages from fullscreen page
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "syncFromFullscreen") {
            // Sync position from fullscreen
            currentIndex = message.currentIndex || 0;
            updateWordDisplay();
            updateProgress();
            updateScrollProgress();
            
            // Resume playing if it was playing before
            if (message.wasPlaying) {
                setTimeout(() => play(), 300);
            }
        }
    });
    
    // ESC key to close overlays
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            settingsOverlay.classList.add('hidden');
            manualInputOverlay.classList.add('hidden');
        }
    });

    // 5. Manual Text Input
    setTextBtn.addEventListener('click', () => {
        manualInputOverlay.classList.remove('hidden');
        manualTextInput.focus();
    });

    cancelInputBtn.addEventListener('click', () => {
         manualInputOverlay.classList.add('hidden');
    });

    loadInputBtn.addEventListener('click', () => {
        const text = manualTextInput.value;
        if (text) {
            loadText(text);
        }
        manualInputOverlay.classList.add('hidden');
    });

    // 6. Progress Bar Scrubbing
    progressBar.addEventListener('input', (e) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) pause();
        currentIndex = parseInt(e.target.value);
        updateDisplay();
        updateProgress();
        if (wasPlaying) play();
    });

    // 7. Context Menu Listener - "Read from here"
    // Uses the clicked word index from content script for precise positioning
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
         // Handle PDF viewer sending content directly
         if (message.action === "loadPdfContent") {
             if (message.content) {
                 if (message.paragraphStarts) {
                     storedParagraphStarts = message.paragraphStarts;
                 }
                 loadText(message.content);
                 showToast(`Loaded ${words.length.toLocaleString()} words from PDF`);
             }
             return;
         }
         
         if (message.action === "contextMenuTriggered") {
             const selectionText = message.selectionText?.trim();
             const clickedWordIndex = message.clickedWordIndex ?? -1;
             
             // Clear current state first
             pause();
             
             // Fetch fresh content from the page
             chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                 if (!tabs[0]) return;
                 
                 // Reset highlight position on the page
                 chrome.tabs.sendMessage(tabs[0].id, { action: "resetHighlightPosition" }).catch(() => {});
                 
                 chrome.tabs.sendMessage(tabs[0].id, { action: "getContent" }, (response) => {
                     if (chrome.runtime.lastError || !response?.content) {
                         if (selectionText) {
                             loadText(selectionText);
                         }
                         return;
                     }
                     
                     const fullText = response.content;
                     const fullWords = fullText.trim().split(/\s+/);
                     
                     // Store paragraph info if provided
                     if (response.paragraphStarts) {
                         storedParagraphStarts = response.paragraphStarts;
                     }
                     
                     // Determine starting position
                     let startIndex = 0;
                     
                     // Priority 1: Use clicked word index if available
                     if (clickedWordIndex >= 0 && clickedWordIndex < fullWords.length) {
                         startIndex = clickedWordIndex;
                         console.log("Flow Mate: Starting from clicked word index", startIndex);
                     }
                     // Priority 2: Try to match selection text
                     else if (selectionText) {
                         const cleanWord = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
                         const selectionWords = selectionText.trim().split(/\s+/);
                         const selectionClean = selectionWords.map(cleanWord);
                         
                         // Match sequence of first 3 words
                         const matchLen = Math.min(3, selectionClean.length);
                         
                         for (let i = 0; i < fullWords.length - matchLen + 1; i++) {
                             let matches = true;
                             for (let j = 0; j < matchLen; j++) {
                                 if (cleanWord(fullWords[i + j]) !== selectionClean[j]) {
                                     matches = false;
                                     break;
                                 }
                             }
                             if (matches) {
                                 startIndex = i;
                                 break;
                             }
                         }
                     }
                     
                     // Load the full content at the determined position
                     words = fullWords;
                     currentIndex = startIndex;
                     lastStepDelta = 1;
                     updateDisplay();
                     updateProgress();
                     
                     // Show toast notification
                     const wordPreview = fullWords.slice(startIndex, startIndex + 3).join(' ');
                     showToast(`Starting from: "${wordPreview}..."`);
                     
                     // Small delay before highlighting
                     setTimeout(() => {
                         broadcastHighlight();
                     }, 100);
                 });
             });
         }
    });

});
