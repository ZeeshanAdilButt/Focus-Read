# Flow Mate

Your personal speed reading companion. Read web pages and PDFs faster using RSVP (Rapid Serial Visual Presentation) technology while maintaining focus and comprehension.

## Features

- **Speed Reading (RSVP)** - Adjustable WPM from 100 to 1000+ words per minute
- **Web Page Reading** - One-click scanning with "Flow from here" right-click context menu
- **Real-time Highlighting** - See your current position highlighted on the actual page
- **PDF Support** - Built-in PDF viewer with word-level highlighting and page navigation
- **Customizable UI** - Choose your colors, fonts, and display preferences
- **Smart Controls** - Pause scaling, loop mode, and flexible navigation options
- **No Sign-ups Required** - Just install and start reading

## Getting Started

### Option 1: Download from Releases (Recommended)

You can simply download the latest version as a zip file:

1. Go to the [Releases page](https://github.com/zeeshanadilbutt/Focus-Read/releases)
2. Download `flow-mate-extension.zip` from the latest release
3. Unzip the file
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" (toggle in the top right)
6. Click "Load unpacked"
7. Select the folder you just unzipped

### Option 2: Download Repository with Pre-built Extension

If you prefer to download the whole repository:

1. **Download the Repository**
   - Go to the [GitHub repository](https://github.com/zeeshanadilbutt/Focus-Read)
   - Click the green "Code" button and select "Download ZIP"
   - Or clone: `git clone https://github.com/zeeshanadilbutt/Focus-Read.git`

2. **Extract and Load**
   - Extract the ZIP file (if downloaded)
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `release` folder from the extracted/cloned repository

3. **Start Using**
   - The extension is now installed and ready to use
   - Click the Flow Mate icon in your Chrome toolbar

### Option 3: Build from Source

If you want to build the extension yourself:

1. **Clone the Repository**
```bash
git clone https://github.com/ZeeshanAdilButt/flow-mate.git
cd flow-mate
```

2. **Install Dependencies**
```bash
npm install
```

3. **Build the Extension**
```bash
npm run build
```

This creates a `dist` folder with the compiled extension.

4. **Load into Chrome**
- Open `chrome://extensions/` in your browser
- Enable "Developer mode" (toggle in the top right corner)
- Click "Load unpacked"
- Select the `dist` folder from your project directory
- The extension is now installed and ready to use

## How to Use Flow Mate
## How to Use Flow Mate
- Click the Flow Mate icon in your Chrome toolbar
- Navigate to any article, then either:
  - Click "Scan Page" to load all text from the page
  - Right-click on any text and select "Flow from here" to start reading from that exact position

## Usage

### Reading Web Pages
Navigate to any article, then either:
- Click "Scan Page" to load all text from the page
- Right-click on any text and select "Flow from here" to start reading from that exact position

### Reading PDFs
- Click the PDF button in Flow Mate
- Select a PDF file from your computer
- Use page navigation to browse through pages
- Click "Read Page" to load the current page for speed reading

### Customization
Access Settings to configure:
- Words per minute (WPM)
- Font family and size
- Background, text, and focus colors
- Pause behavior at punctuation
- Skip navigation mode and amount


## Project Structure

```
flow-mate/
├── src/
│   ├── background.js       # Service worker and context menu handler
│   ├── content.js          # Page interaction and text highlighting
│   ├── sidepanel/
│   │   ├── sidepanel.html  # Main UI
│   │   ├── sidepanel.css   # Styling
│   │   └── sidepanel.js    # RSVP speed reading engine
│   ├── viewer/
│   │   ├── viewer.html     # PDF viewer interface
│   │   ├── viewer.css      # PDF viewer styling
│   │   └── viewer.js       # PDF rendering and text extraction
│   └── fullscreen/
│       ├── fullscreen.html # Full-screen mode
│       ├── fullscreen.css  # Full-screen styling
│       └── fullscreen.js   # Full-screen logic
├── assets/
│   └── icon.svg            # Extension icon
├── manifest.json           # Chrome extension manifest (v3)
├── webpack.config.js       # Build configuration
└── package.json
```

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Development build with watch mode
npm run dev
```

## Technical Stack

- Manifest V3 (latest Chrome extension standard)
- JavaScript ES6+
- Webpack 5 for bundling
- pdf.js for PDF rendering
- Chrome Extension APIs: Side Panel, Active Tab, Scripting, Context Menus

## Contributing

Contributions are welcome. Feel free to submit a Pull Request with improvements.

## License

This project is licensed under the MIT License.
