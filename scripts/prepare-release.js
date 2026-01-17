const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Copy dist folder to release folder
const distPath = path.join(__dirname, '..', 'dist');
const releasePath = path.join(__dirname, '..', 'release');
const zipPath = path.join(__dirname, '..', 'flow-mate-extension.zip');

// Clean release folder if it exists
if (fs.existsSync(releasePath)) {
  fs.rmSync(releasePath, { recursive: true, force: true });
}

// Create release folder
fs.mkdirSync(releasePath, { recursive: true });

// Copy all files from dist to release
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursiveSync(distPath, releasePath);

// Create a README in the release folder
const releaseReadme = `# Flow Mate - Pre-built Extension

This folder contains a ready-to-use version of Flow Mate that can be loaded directly into Chrome without building.

## Installation

1. Download this entire folder (or clone the repository)
2. Open Chrome and navigate to \`chrome://extensions/\`
3. Enable "Developer mode" (toggle in the top right corner)
4. Click "Load unpacked"
5. Select this \`release\` folder
6. The extension is now installed and ready to use!

## Usage

- Click the Flow Mate icon in your Chrome toolbar
- Navigate to any webpage
- Right-click and select "Flow from here" to start reading from that position
- Or use the "Scan Page" button to load the entire page
- Adjust WPM settings and customize colors in the settings panel

For full documentation, visit: https://github.com/yourusername/flow-mate
`;

fs.writeFileSync(path.join(releasePath, 'README.md'), releaseReadme);

console.log('✓ Release folder prepared successfully!');
console.log('  Location: release/');

// Create zip file
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function() {
  console.log('✓ Zip file created successfully!');
  console.log(`  Location: flow-mate-extension.zip (${archive.pointer()} total bytes)`);
  console.log('  Ready to be uploaded to GitHub Releases');
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);
archive.directory(releasePath, false);
archive.finalize();

