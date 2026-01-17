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
    const setTextBtn = document.getElementById('setTextBtn');
    const manualInputOverlay = document.getElementById('manualInputOverlay');
    const manualTextInput = document.getElementById('manualTextInput');
    const loadInputBtn = document.getElementById('loadInputBtn');
    const cancelInputBtn = document.getElementById('cancelInputBtn');

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
        focusColor: '#e74c3c'
    };

    // UI Elements for Mode
    const modeWordBtn = document.getElementById('modeWordBtn');
    const modeSentenceBtn = document.getElementById('modeSentenceBtn');
    const chunkSizeContainer = document.getElementById('chunkSizeContainer');
    const sentenceLengthContainer = document.getElementById('sentenceLengthContainer');

    // --- ORP Logic (Optimal Recognition Point) ---
    function formatWord(word) {
        if (!word) return "&nbsp;";
        // If mode is sentence, don't use ORP, just text
        if (config.mode === 'sentence') return word;

        const idx = Math.ceil(word.length / 2) - 1;
        const start = word.slice(0, idx);
        const char = word.slice(idx, idx + 1);
        const end = word.slice(idx + 1);
        
        return `${start}<span class="highlight-char" style="color: ${config.focusColor}">${char}</span>${end}`;
    }

    // --- Core Reader Logic ---

    // Calculate base interval (ms per chunk)
    function getIntervalForChunk(chunk, isSentence) {
        if (!chunk) return 100;

        if (isSentence) {
            // Estimate words in sentence
            const wordCount = chunk.split(/\s+/).length;
            // Time = (Words / WPM) * 60000
            // Add a bit of buffer for reading ease?
            return (wordCount / config.wpm) * 60000;
        } else {
             return (60000 / config.wpm) * config.chunkSize;
        }
    }

    function updateDisplay() {
        // Apply styles
        document.body.style.backgroundColor = config.bgColor;
        wordDisplay.style.color = config.textColor;
        wordDisplay.style.fontFamily = config.font;
        // Sentence mode might need smaller font
        const baseSize = config.mode === 'sentence' ? 1.5 : 3;
        wordDisplay.style.fontSize = `${baseSize * config.fontScale}rem`;
        // Ensure multiline for sentences
        wordDisplay.style.whiteSpace = config.mode === 'sentence' ? 'normal' : 'nowrap';
        // ... (other UI color sync)

        if (words.length === 0) {
            wordDisplay.innerHTML = '<span class="placeholder">Ready</span>';
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
        
        if (config.mode === 'word' && config.chunkSize === 1) {
            wordDisplay.innerHTML = formatWord(chunk);
        } else {
            wordDisplay.innerText = chunk;
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

        let delay;
        
        // Calculate delay based on the text we just showed
        if (config.mode === 'sentence') {
             // For sentence mode, we use the word count of the sentence to determine time
             delay = getIntervalForChunk(currentChunkText, true);
             // Pause longer for sentences? Or is it built into WPM?
             // Use pauseScale for between sentences if requested
             if (config.pauses) {
                 delay = delay * config.pauseScale; 
             }
        } else {
             // Word mode
             delay = getIntervalForChunk(null, false); // uses config.chunkSize inside
             
             // Punctuation logic for Word mode
             if (config.pauses && currentChunkText) {
                 const lastChar = currentChunkText.slice(-1);
                 if (['.', '!', '?', ';'].includes(lastChar)) {
                    delay = delay * config.pauseScale;
                 } else if ([','].includes(lastChar)) {
                    delay = delay * (1 + (config.pauseScale - 1) / 2);
                 }
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
        
        // Broadcast
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) { 
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "highlight", 
                    index: currentIndex,
                    text: words[currentIndex] 
                }).catch(() => {});
            }
        });

        updateProgress();
        scheduleNextStep(chunk);
    }

    function play() {
        if (words.length === 0) return;
        isPlaying = true;
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        
        // Display CURRENT index immediately
        const { chunk, nextIndexChange } = updateDisplay();
        lastStepDelta = nextIndexChange;
        
        scheduleNextStep(chunk);
    }

    function pause() {
        isPlaying = false;
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function loadText(text, indexToStart = 0) {
        if (!text) return;
        words = text.trim().split(/\s+/);
        currentIndex = indexToStart;
        updateDisplay();
        updateProgress();
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
            pauses: true,
            loop: false,
            pauseScale: 1.5,
            font: "'Segoe UI', sans-serif",
            fontScale: 1,
            bgColor: '#000000',
            textColor: '#ffffff',
            focusColor: '#e74c3c'
        };
        syncSettingsUI();
    });

    // 1. Auto-load from active tab on open
    async function fetchPageContent() {
         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
         if (tab) {
             // Ask for content
             chrome.tabs.sendMessage(tab.id, { action: "getContent" }, (response) => {
                if (chrome.runtime.lastError) {
                    // Script likely not injected in this tab (e.g. chrome:// URL or restricted)
                    console.log("Could not auto-load content:", chrome.runtime.lastError.message);
                    wordDisplay.innerHTML = '<span class="placeholder">Error/Reload</span>';
                } else if (response && response.content) {
                    loadText(response.content);
                } else {
                     wordDisplay.innerHTML = '<span class="placeholder">No text found</span>';
                }
             });
         }
    }

    fetchPageContent(); // Run on load

    scanPageBtn.addEventListener('click', () => {
        fetchPageContent();
    });

    // 2. Play/Pause
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) pause();
        else play();
    });

    // 3. Navigation
    prevBtn.addEventListener('click', () => {
        // Back 10 words or 10 seconds? User asked "Back 10s" in tooltip but logically word jump is easier
        const jump = Math.round(config.wpm / 6); // ~10 seconds worth of words
        currentIndex = Math.max(0, currentIndex - jump);
        updateDisplay();
        updateProgress();
    });

    nextBtn.addEventListener('click', () => {
        const jump = Math.round(config.wpm / 6);
        currentIndex = Math.min(words.length - 1, currentIndex + jump);
        updateDisplay();
        updateProgress();
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

    // 7. Context Menu Listener
    // The background script cannot easily message us if we weren't open.
    // However, if we are open, we can listen for runtime messages.
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
         if (message.action === "contextMenuTriggered") {
             // We received a selection from context menu!
             if (message.selectionText) {
                 // Option A: Just read the selection
                 // Option B: Find selection in the FULL text and start there.
                 // For MVP, if they select text, let's just read that text.
                 // If they want to "read from here" in context of full page, it requires finding the index.
                 // That search is complex if the selection is generic. 
                 
                 // Let's check if we already have words loaded.
                 if (words.length > 0) {
                     // Try to find this snippet in our current words list
                     // Flatten words to string
                     const currentFullText = words.join(' ');
                     const searchIndex = currentFullText.indexOf(message.selectionText.trim());
                     
                     if (searchIndex !== -1) {
                         // Convert char index to word index
                         // Rough estimate: count spaces before the match
                         const textBefore = currentFullText.substring(0, searchIndex);
                         const wordIndex = textBefore.split(/\s+/).length;
                         currentIndex = wordIndex;
                         updateDisplay();
                         updateProgress();
                         return; // Done
                     }
                 }
                 
                 // Fallback: Just load the selection as new text
                 loadText(message.selectionText);
             }
         }
    });

});
