#!/usr/bin/env node
/**
 * Generate favicon and OG image assets from SVG source.
 * Run: node scripts/generate-assets.mjs
 * Requires: sharp (npx sharp or install)
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../client/public');
const faviconSvg = join(publicDir, 'favicon.svg');

// Generate PNGs from SVG using sharp-cli
function sharp(input, output, width, height) {
  const h = height || width;
  execSync(`npx sharp-cli -i "${input}" -o "${output}" resize ${width} ${h} --fit contain --background "transparent"`, { stdio: 'inherit' });
}

// favicon-32.png for ICO conversion
sharp(faviconSvg, join(publicDir, 'favicon-32.png'), 32, 32);

// Apple touch icon 180x180
sharp(faviconSvg, join(publicDir, 'apple-touch-icon.png'), 180, 180);

// favicon-16 for multi-size ico
sharp(faviconSvg, join(publicDir, 'favicon-16.png'), 16, 16);

// Use the 32px PNG as favicon.ico (browsers accept PNG in .ico)
execSync(`cp "${join(publicDir, 'favicon-32.png')}" "${join(publicDir, 'favicon.ico')}"`);

// Generate OG image (1200x630) — a simple branded card
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FAF7F2"/>
      <stop offset="100%" style="stop-color:#E8F5F0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Brand accent bar -->
  <rect x="0" y="0" width="1200" height="6" fill="#1B6B5A"/>

  <!-- Card icon (larger version) -->
  <g transform="translate(100, 160) scale(4)">
    <rect x="5" y="4" width="20" height="24" rx="2.5" fill="#FAF7F2" stroke="#1B6B5A" stroke-width="1.5"/>
    <rect x="9" y="9" width="12" height="1.8" rx="0.9" fill="#1B6B5A"/>
    <rect x="9" y="14" width="10" height="1.4" rx="0.7" fill="#1B6B5A" opacity="0.4"/>
    <rect x="9" y="18" width="8" height="1.4" rx="0.7" fill="#1B6B5A" opacity="0.4"/>
    <circle cx="23" cy="24" r="6" fill="#1B6B5A"/>
    <path d="M23 20.5L23.8 22.7L26 23.5L23.8 24.3L23 26.5L22.2 24.3L20 23.5L22.2 22.7Z" fill="#FAF7F2"/>
  </g>

  <!-- Title -->
  <text x="340" y="250" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="72" font-weight="800" fill="#1A1614">AI Notecards</text>

  <!-- Tagline -->
  <text x="340" y="320" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="32" font-weight="500" fill="#6B635A">Study Smarter, Not Harder</text>

  <!-- Features -->
  <text x="340" y="400" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="24" fill="#1B6B5A">Paste notes</text>
  <text x="520" y="400" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="24" fill="#6B635A">&#8594;</text>
  <text x="560" y="400" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="24" fill="#1B6B5A">AI generates cards</text>
  <text x="830" y="400" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="24" fill="#6B635A">&#8594;</text>
  <text x="870" y="400" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="24" fill="#1B6B5A">Study &amp; retain</text>

  <!-- URL -->
  <text x="340" y="500" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="22" fill="#6B635A">ainotecards.com</text>

  <!-- Bottom accent -->
  <rect x="0" y="624" width="1200" height="6" fill="#1B6B5A"/>
</svg>`;

const ogSvgPath = join(publicDir, 'og-image.svg');
writeFileSync(ogSvgPath, ogSvg);
sharp(ogSvgPath, join(publicDir, 'og-image.png'), 1200, 630);

// Cleanup temp files
execSync(`rm -f "${join(publicDir, 'favicon-16.png')}" "${join(publicDir, 'favicon-32.png')}" "${ogSvgPath}"`);

console.log('Assets generated successfully:');
console.log('  - favicon.ico (32x32)');
console.log('  - favicon.svg (scalable)');
console.log('  - apple-touch-icon.png (180x180)');
console.log('  - og-image.png (1200x630)');
