/*
 * Resume PDF renderer.
 * Usage: node render-pdf.mjs <input.md> <output.pdf>
 *
 * Reads a Markdown file, converts to HTML with marked,
 * wraps it in github-markdown-css + a print stylesheet,
 * then prints to PDF via Puppeteer.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '..');

// Locate a usable Chrome binary. Prefer system Google Chrome (avoids the
// ~300MB Chromium download that puppeteer's bundled installer triggers),
// then fall back to common Chromium locations.
function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);

  if (!inputArg || !outputArg) {
    die('Usage: node render-pdf.mjs <input.md> <output.pdf>');
  }

  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);

  if (!existsSync(inputPath)) {
    die(`Input file not found: ${inputPath}`);
  }

  // Read the Markdown content
  const markdown = readFileSync(inputPath, 'utf-8');

  // Convert Markdown -> HTML
  const htmlBody = marked.parse(markdown);

  // Read the github-markdown-css from node_modules
  const ghmCssPath = join(
    SKILL_ROOT,
    'node_modules',
    'github-markdown-css',
    'github-markdown-light.css'
  );
  let ghmCss = '';
  if (existsSync(ghmCssPath)) {
    ghmCss = readFileSync(ghmCssPath, 'utf-8');
  } else {
    console.warn(
      `Warning: github-markdown-css not found at ${ghmCssPath}. Falling back to no base styles.`
    );
  }

  // Read the print stylesheet (page size, margins, density tweaks)
  const printCssPath = join(SKILL_ROOT, 'assets', 'print.css');
  let printCss = '';
  if (existsSync(printCssPath)) {
    printCss = readFileSync(printCssPath, 'utf-8');
  }

  // Assemble the full HTML document
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resume</title>
  <style>
${ghmCss}

${printCss}
  </style>
</head>
<body>
  <div class="markdown-body">
${htmlBody}
  </div>
</body>
</html>`;

  // Write a temp HTML file for debugging if needed
  const tempHtmlPath = outputPath.replace(/\.pdf$/, '.html');
  writeFileSync(tempHtmlPath, html, 'utf-8');

  // Launch Puppeteer and print to PDF
  const chromePath = findChrome();
  if (!chromePath) {
    die(
      'No Chrome/Chromium/Edge found. Install Google Chrome or edit findChrome() in render-pdf.mjs to point at a browser.'
    );
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
    });

    console.log(`PDF generated: ${outputPath}`);
    console.log(`Debug HTML:   ${tempHtmlPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  die(err.message);
});
