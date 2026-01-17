// Flow Mate Fullscreen Reader
// This page receives content from sidepanel and provides immersive reading experience

// DOM Elements
const wordDisplay = document.getElementById('wordDisplay');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const exitBtn = document.getElementById('exitBtn');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const wpmDisplayEl = document.getElementById('wpmDisplay');
const timeRemainingEl = document.getElementById('timeRemaining');

// State
let words = [];
let currentIndex = 0;
let isPlaying = false;
let timer = null;
let config = {
    wpm: 300,
    chunkSize: 1,
    mode: 'word',
    pauses: true,
    pauseScale: 1.5,
    focusColor: '#e74c3c',
    navMode: 'seconds',
    navAmount: 10
};

// Mouse activity tracking
let hideTimeout;
function showControls() {
    document.body.classList.add('show-cursor');
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        if (isPlaying) {
            document.body.classList.remove('show-cursor');
        }
    }, 2500);
}
document.addEventListener('mousemove', showControls);
showControls();

// Request fullscreen on load
document.addEventListener('DOMContentLoaded', () => {
    // Request fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
    
    // Request content from sidepanel
    chrome.runtime.sendMessage({ action: "getFullscreenContent" }, (response) => {
        if (response && response.words && response.words.length > 0) {
            words = response.words;
            currentIndex = response.currentIndex || 0;
            config = { ...config, ...response.config };
            wpmDisplayEl.textContent = config.wpm + ' WPM';
            updateDisplay();
            updateProgress();
            
            // Auto-play if it was playing
            if (response.wasPlaying) {
                setTimeout(() => play(), 500);
            }
        } else {
            wordDisplay.innerHTML = '<span class="placeholder">No content loaded</span>';
        }
    });
});

// Exit fullscreen handler
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        // Sync state back to sidepanel and close
        syncAndClose();
    }
});

function syncAndClose() {
    pause();
    chrome.runtime.sendMessage({
        action: "fullscreenClosed",
        currentIndex: currentIndex,
        wasPlaying: isPlaying
    });
    window.close();
}

// ORP Formatting
function formatWord(word) {
    if (!word) return "&nbsp;";
    word = word.trim();
    const len = word.length;
    if (len === 0) return "&nbsp;";
    
    let orpIndex;
    if (len <= 1) orpIndex = 0;
    else if (len <= 5) orpIndex = 1;
    else if (len <= 9) orpIndex = 2;
    else if (len <= 13) orpIndex = 3;
    else orpIndex = 4;
    
    const before = word.substring(0, orpIndex);
    const focus = word.charAt(orpIndex);
    const after = word.substring(orpIndex + 1);
    
    return `${before}<span class="focus-letter" style="color:${config.focusColor}">${focus}</span>${after}`;
}

function formatChunk(text) {
    const wordsArr = text.split(/\s+/).filter(w => w.length > 0);
    return wordsArr.map(formatWord).join(' ');
}

// Display
function updateDisplay() {
    if (words.length === 0) {
        wordDisplay.innerHTML = '<span class="placeholder">No content</span>';
        return;
    }
    
    let chunk = "";
    let nextChange = 0;
    
    if (config.mode === 'sentence') {
        wordDisplay.classList.add('sentence-mode');
        wordDisplay.classList.remove('chunk-mode');
        
        let idx = currentIndex;
        let collected = [];
        while (idx < words.length) {
            collected.push(words[idx]);
            if (/[.?!]$/.test(words[idx]) || collected.length > 30) break;
            idx++;
        }
        chunk = collected.join(' ');
        nextChange = collected.length;
    } else {
        wordDisplay.classList.remove('sentence-mode');
        if (config.chunkSize > 1) {
            wordDisplay.classList.add('chunk-mode');
        } else {
            wordDisplay.classList.remove('chunk-mode');
        }
        chunk = words.slice(currentIndex, currentIndex + config.chunkSize).join(' ');
        nextChange = config.chunkSize;
    }
    
    if (!chunk) {
        pause();
        currentIndex = 0;
        return { chunk: '', nextIndexChange: 0 };
    }
    
    wordDisplay.innerHTML = formatChunk(chunk);
    return { chunk, nextIndexChange: nextChange };
}

function updateProgress() {
    if (words.length === 0) return;
    
    const percent = Math.round((currentIndex / words.length) * 100);
    progressBar.style.width = percent + '%';
    progressText.textContent = percent + '%';
    
    const wordsLeft = words.length - currentIndex;
    const minutesLeft = wordsLeft / config.wpm;
    const mins = Math.floor(minutesLeft);
    const secs = Math.ceil((minutesLeft - mins) * 60);
    timeRemainingEl.textContent = (mins > 0 ? `${mins}m ` : '') + `${secs}s`;
}

// Playback
function getInterval(text) {
    const baseInterval = 60000 / config.wpm;
    if (config.mode === 'sentence') {
        const wordCount = text.split(/\s+/).length;
        return baseInterval * wordCount;
    }
    return baseInterval * config.chunkSize;
}

function scheduleNext(chunkText) {
    if (!isPlaying) return;
    
    let delay = getInterval(chunkText);
    
    if (config.pauses && chunkText) {
        const lastChar = chunkText.trim().slice(-1);
        if (['.', '!', '?'].includes(lastChar)) {
            delay *= config.pauseScale;
        } else if ([';', ':'].includes(lastChar)) {
            delay *= (1 + (config.pauseScale - 1) * 0.7);
        } else if ([','].includes(lastChar)) {
            delay *= (1 + (config.pauseScale - 1) * 0.4);
        }
    }
    
    timer = setTimeout(() => {
        const chunkSize = config.mode === 'sentence' 
            ? (chunkText.split(/\s+/).length) 
            : config.chunkSize;
        
        currentIndex += chunkSize;
        if (currentIndex >= words.length) {
            pause();
            currentIndex = 0;
            updateDisplay();
            updateProgress();
            return;
        }
        
        const { chunk } = updateDisplay();
        updateProgress();
        broadcastHighlight();
        scheduleNext(chunk);
    }, delay);
}

function play() {
    if (words.length === 0) return;
    isPlaying = true;
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    document.body.classList.remove('show-cursor');
    
    const { chunk } = updateDisplay();
    broadcastHighlight();
    scheduleNext(chunk);
}

function pause() {
    isPlaying = false;
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    document.body.classList.add('show-cursor');
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    // Keep highlight visible when paused
}

function broadcastHighlight() {
    const chunkSize = config.mode === 'sentence' ? 15 : config.chunkSize;
    chrome.runtime.sendMessage({
        action: "highlightFromFullscreen",
        index: currentIndex,
        wordCount: chunkSize,
        text: words.slice(currentIndex, currentIndex + chunkSize).join(' ')
    });
}

// Navigation
function stepNavigation(direction) {
    let jump = Math.round((config.wpm / 60) * 10); // Default: 10 seconds worth
    
    if (direction > 0) {
        currentIndex = Math.min(words.length - 1, currentIndex + jump);
    } else {
        currentIndex = Math.max(0, currentIndex - jump);
    }
    
    updateDisplay();
    updateProgress();
    if (isPlaying) broadcastHighlight();
}

// Event Listeners
playPauseBtn.addEventListener('click', () => {
    if (isPlaying) pause(); else play();
});

prevBtn.addEventListener('click', () => stepNavigation(-1));
nextBtn.addEventListener('click', () => stepNavigation(1));

exitBtn.addEventListener('click', () => {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
    syncAndClose();
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) pause(); else play();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepNavigation(-1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepNavigation(1);
    } else if (e.key === 'Escape') {
        syncAndClose();
    }
});

// Sync state periodically
setInterval(() => {
    if (words.length > 0) {
        chrome.runtime.sendMessage({
            action: "fullscreenSync",
            currentIndex: currentIndex
        });
    }
}, 1000);
