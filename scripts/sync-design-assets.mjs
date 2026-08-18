// Re-run whenever design/assets/app-icon.png or design/pictograms.svg change
// (e.g. after a fresh /design-sync pull). Run: node scripts/sync-design-assets.mjs
//
// Copies straight into static/ rather than relying on a build-time copy
// plugin: vite-plugin-static-copy only runs its copy on production build,
// not under `vite dev` — static/ is the one thing SvelteKit serves
// identically in both dev and build, so it's the more reliable target for a
// rarely-changing asset like this sprite.
import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'node:fs';

const SRC = 'design/assets/app-icon.png';
const OUT_DIR = 'static/icons';
// 180 is iOS's native apple-touch-icon size — it was previously downsampling
// the 192 for the Home Screen, which is visibly soft on the springboard.
const SIZES = [180, 192, 512];

mkdirSync(OUT_DIR, { recursive: true });

copyFileSync('design/pictograms.svg', 'static/pictograms.svg');
console.log('  static/pictograms.svg');

for (const size of SIZES) {
	await sharp(SRC).resize(size, size).png().toFile(`${OUT_DIR}/icon-${size}.png`);
	console.log(`  ${OUT_DIR}/icon-${size}.png`);
}

// Maskable variant: Android applies its own safe-zone crop, so pad the source
// onto a full-bleed square in the icon's own background (matches the app-icon
// spec's gradient endpoints) rather than shipping the same tight artwork twice.
// 410 + 51*2 = 512, matching the size the manifest declares — this used to
// emit 1024x1024 while declaring 512x512, which makes Chromium rescale and can
// throw off the adaptive-icon mask.
await sharp(SRC)
	.resize(410, 410)
	.extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#0A463B' })
	.png()
	.toFile(`${OUT_DIR}/icon-512-maskable.png`);
console.log(`  ${OUT_DIR}/icon-512-maskable.png`);

// The PWA install-dialog screenshots and the landing hero are deliberately NOT
// generated here: sharp cannot rasterise HTML, and those images have to be
// renders of actual screens rather than of the design-system specimen cards.
// See scripts/capture-screenshots.mjs, which drives headless Chrome instead.
console.log('Done. (Screenshots: node scripts/capture-screenshots.mjs)');
