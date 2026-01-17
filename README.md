# Flow Mate 🌊

**Your Personal Speed Reading Companion**

Flow Mate is a premium Chrome extension that transforms how you consume content online. Using RSVP (Rapid Serial Visual Presentation) technology with focus-enhancing ORP (Optimal Recognition Point) highlighting, you can read web pages and PDFs 2-3x faster while maintaining comprehension.

## ✨ Features

### 🚀 Speed Reading (RSVP)
- **Adjustable WPM** - Read from 100 to 1000+ words per minute
- **ORP Highlighting** - Red focus character on each word for optimal eye positioning
- **Word & Sentence Modes** - Choose single words or full sentences
- **Multi-word Display** - Show 1-5 words at a time

### 📖 Web Page Reading
- **One-Click Scanning** - Extract text from any webpage instantly
- **"Flow from here"** - Right-click any text to start reading from that exact position
- **Real-time Highlighting** - See your current position highlighted on the page
- **Smart Navigation** - Skip by seconds, words, sentences, or paragraphs

### 📄 PDF Support
- **Built-in PDF Viewer** - Open and read PDFs directly in the extension
- **Word-Level Highlighting** - See exactly which word you're reading
- **Page Navigation** - Jump to any page instantly
- **Text Selection** - Toggle selection mode to copy text for research

### 🎨 Premium UI
- **Dark Theme** - Easy on the eyes for extended reading sessions
- **Customizable Colors** - Personalize background, text, and focus colors
- **Font Options** - Choose from multiple font families and sizes
- **Clean Side Panel** - Stays out of your way while reading

### ⚙️ Smart Controls
- **Pause Scaling** - Automatic pauses at punctuation for natural rhythm
- **Loop Mode** - Continuous reading for practice or memorization
- **Progress Tracking** - See percentage complete and time remaining
- **Keyboard Shortcuts** - ESC to close overlays

## 🛠️ Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flow-mate.git
   cd flow-mate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## 🚀 Usage

### Quick Start
1. Click the Flow Mate icon in your Chrome toolbar
2. The side panel opens automatically
3. Click the **Play** button to start reading

### Reading Web Pages
- Navigate to any article or webpage
- Click the **Scan Page** button (📄) to load the content
- Adjust WPM with the slider
- Press **Play** to begin

### "Flow from here"
1. Select any text on a webpage (or just right-click anywhere)
2. Right-click and choose **"Flow from here"**
3. Reading starts from your selected position

### Reading PDFs
1. Click the **PDF** button (📑) in Flow Mate
2. Choose a PDF file from your computer
3. Click **Read Page** to load the text
4. Use the **Select Text** toggle to enable text selection for copying
5. Use page input or arrows to navigate to any page

### Navigation
- **◀ / ▶** - Skip backward/forward based on settings
- **↩️** - Restart from beginning
- **Settings** - Configure skip amount (seconds, words, sentences, paragraphs)

## ⚙️ Settings

| Setting | Description |
|---------|-------------|
| **WPM** | Words per minute (100-1000+) |
| **Words to Display** | Number of words shown at once (1-5) |
| **Mode** | Word-by-word or Sentence mode |
| **Pauses** | Enable natural pauses at punctuation |
| **Pause Scale** | How long to pause (1.0x - 3.0x) |
| **Font** | Choose display font family |
| **Font Scale** | Adjust text size (0.5x - 2.0x) |
| **Colors** | Customize background, text, and focus colors |
| **Skip By** | Navigation mode (seconds/words/sentences/paragraphs) |
| **Skip Amount** | How much to skip when navigating |

## 🏗️ Project Structure

```
flow-mate/
├── src/
│   ├── background.js       # Service worker & context menu
│   ├── content.js          # Page interaction & highlighting
│   ├── sidepanel/
│   │   ├── sidepanel.html  # Main UI structure
│   │   ├── sidepanel.css   # Premium styling
│   │   └── sidepanel.js    # RSVP logic & controls
│   └── viewer/
│       ├── viewer.html     # PDF viewer page
│       ├── viewer.css      # PDF viewer styling
│       └── viewer.js       # PDF rendering & text extraction
├── assets/
│   └── icon.svg            # Extension icon
├── manifest.json           # Chrome extension manifest (v3)
├── webpack.config.js       # Build configuration
└── package.json
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

## 📝 Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **APIs Used**: Side Panel, Active Tab, Scripting, Context Menus
- **PDF Library**: pdf.js (Mozilla)
- **Build Tool**: Webpack 5

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [pdf.js](https://mozilla.github.io/pdf.js/) - Mozilla's PDF rendering library
- [Font Awesome](https://fontawesome.com/) - Icons
- [Google Fonts](https://fonts.google.com/) - Inter font family

---

**Flow Mate** - Read faster. Learn more. Flow with it. 🌊
