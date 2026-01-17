# Focus Read - Speed Reader & PDF Highlighter

Focus Read is a Chrome Extension designed to help you speed read content from the web and PDF files. It features a split-view interface with the original content on the left and a RSVP (Rapid Serial Visual Presentation) speed reader on the right logic.

## Features
- **Speed Reader**: RSVP style reading with adjustable WPM and chunk size.
- **Pause & Resume**: Intelligently pauses without losing context.
- **Split View**: Keeps the original content visible while reading.
- **PDF Support**: Drag and drop PDF files into the viewer to speed read them.
- **Highlighting**: Synced highlighting (page scrolling) in the PDF viewer.

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```
   This will create a `dist` folder containing the compiled extension.

3. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (top right).
   - Click **Load unpacked**.
   - Select the `dist` folder from this project.

## Usage

1. **Web Pages**: Click the extension icon to open the Side Panel. Click "Load Page Text" to start reading.
2. **PDF Files**:
   - The extension includes a specialized PDF Viewer.
   - Open `dist/viewer.html` (or construct the URL `chrome-extension://<ID>/viewer.html`) to access it. 
   - *Tip*: You can pin the extension and use the future "Open PDF Viewer" button (not yet in MVP options) or just drag a PDF into Chrome if you configure file access.
   - For this MVP: Navigate to the `viewer.html` URL manually or via a bookmark.
   - Load a PDF using the file input at the top.
   - Open the Side Panel.
   - Click "Load Page Text".
   
## Architecture
- **Tech Stack**: JavaScript, HTML, CSS, Webpack.
- **PDF Handling**: Uses `pdfjs-dist` to render PDFs in a custom viewer page.
- **State Management**: Syncs index buffer between Side Panel (Reader) and Content (Viewer).
