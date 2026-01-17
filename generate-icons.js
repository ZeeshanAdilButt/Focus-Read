const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d0d0d"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff1a1a"/>
      <stop offset="100%" stop-color="#cc0000"/>
    </linearGradient>
  </defs>
  
  <!-- Rounded square background -->
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bgGrad)"/>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="none" stroke="rgba(255,0,0,0.2)" stroke-width="1"/>
  
  <!-- Stylized F for Flow with speed lines -->
  <g>
    <!-- Main F stem -->
    <rect x="36" y="32" width="12" height="64" rx="6" fill="url(#accentGrad)"/>
    <!-- F top bar -->
    <rect x="36" y="32" width="48" height="12" rx="6" fill="url(#accentGrad)"/>
    <!-- F middle bar with focus dot -->
    <rect x="36" y="56" width="36" height="10" rx="5" fill="url(#accentGrad)" opacity="0.85"/>
    
    <!-- Speed lines (flow effect) -->
    <rect x="68" y="72" width="28" height="6" rx="3" fill="#ff1a1a" opacity="0.3"/>
    <rect x="76" y="84" width="20" height="5" rx="2.5" fill="#ff1a1a" opacity="0.2"/>
  </g>
  
  <!-- Focus indicator dot -->
  <circle cx="80" cy="61" r="6" fill="#fff"/>
</svg>`;

const sizes = [16, 32, 48, 128];
const assetsDir = path.join(__dirname, 'assets');

async function generateIcons() {
    for (const size of sizes) {
        const outputPath = path.join(assetsDir, `icon${size}.png`);
        await sharp(Buffer.from(svgContent))
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Generated: ${outputPath}`);
    }
    console.log('All icons generated!');
}

generateIcons().catch(console.error);
