// Rasterises scripts/capture/*.html into the PWA install-dialog screenshots
// (static/screenshots/) and the landing-page hero (static/marketing/).
//
// Uses the locally installed Chrome in headless mode rather than adding
// Playwright or Puppeteer to package.json — these are three PNGs that change
// maybe twice a year, and the dependency would be carried by every install and
// every CI run forever for that.
//
// The pages are served over HTTP, not opened as file:// URLs, because the
// screens reference the pictogram sprite via <use href="pictograms.svg#id">
// and external SVG references are blocked under file://.
//
//   node scripts/capture-screenshots.mjs
//
// Re-run after any change to design/colors_and_type.css or the capture pages.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8749;

const CHROME =
	process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png'
};

/** @type {{page: string, out: string, width: number, height: number, scale: number, transparent?: boolean}[]} */
const SHOTS = [
	// Narrow entries must share one aspect ratio or Chromium drops the whole
	// screenshots set from the install dialog. Both are 390x844 @2x.
	{
		page: 'today.html',
		out: 'static/screenshots/today-narrow.png',
		width: 390,
		height: 844,
		scale: 2
	},
	{
		page: 'medicines.html',
		out: 'static/screenshots/medicines-narrow.png',
		width: 390,
		height: 844,
		scale: 2
	},
	{
		page: 'today-wide.html',
		out: 'static/screenshots/today-wide.png',
		width: 960,
		height: 540,
		scale: 2
	},
	{
		page: 'hero-phone.html',
		out: 'static/marketing/today-hero.png',
		width: 446,
		height: 900,
		scale: 2,
		transparent: true
	}
];

function serve() {
	const server = createServer((req, res) => {
		const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(
			/^(\.\.[/\\])+/,
			''
		);
		const file = join(ROOT, rel);
		if (!file.startsWith(ROOT)) {
			res.writeHead(403).end();
			return;
		}
		const stream = createReadStream(file);
		stream.on('error', () => res.writeHead(404).end());
		stream.on('open', () => {
			res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
			stream.pipe(res);
		});
	});
	return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

function chrome(args) {
	return new Promise((resolve, reject) => {
		const child = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
		let stderr = '';
		child.stderr.on('data', (c) => (stderr += c));
		child.on('error', reject);
		child.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`Chrome exited ${code}\n${stderr}`))
		);
	});
}

const server = await serve();
try {
	await mkdir(join(ROOT, 'static/screenshots'), { recursive: true });
	await mkdir(join(ROOT, 'static/marketing'), { recursive: true });

	for (const shot of SHOTS) {
		const out = join(ROOT, shot.out);
		// Chrome refuses to overwrite, and a stale file would pass silently.
		await rm(out, { force: true });
		await chrome([
			'--headless',
			'--disable-gpu',
			'--hide-scrollbars',
			`--force-device-scale-factor=${shot.scale}`,
			`--window-size=${shot.width},${shot.height}`,
			...(shot.transparent ? ['--default-background-color=00000000'] : []),
			`--screenshot=${out}`,
			`http://localhost:${PORT}/scripts/capture/${shot.page}`
		]);
		const { size } = await readFile(out).then((b) => ({ size: b.length }));
		console.log(
			`${shot.out}  ${shot.width * shot.scale}x${shot.height * shot.scale}  ${(size / 1024).toFixed(0)} KB`
		);
	}
} finally {
	server.close();
}
