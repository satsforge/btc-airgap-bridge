import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

function sha256b64(str) {
  return createHash('sha256').update(str, 'utf8').digest('base64');
}

async function main() {
  mkdirSync('dist', { recursive: true });

  const jsResult = await build({
    entryPoints: ['src/app.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome100', 'firefox100', 'safari15'],
    legalComments: 'none',
    write: false,
  });
  let scriptCode = jsResult.outputFiles[0].text;
  // Defensively neutralize any literal "</script" that could prematurely
  // terminate the inline <script> tag once inlined into the HTML shell.
  scriptCode = scriptCode.replace(/<\/script/gi, '<\\/script');

  const cssSource = readFileSync('src/styles.css', 'utf8');
  const cssResult = await transform(cssSource, { loader: 'css', minify: true });
  const cssCode = cssResult.code.trim();

  const scriptHash = sha256b64(scriptCode);
  const csp = [
    "default-src 'none'",
    `script-src 'sha256-${scriptHash}'`,
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // This tool's whole job is talking to the network (fetch UTXOs/fees,
    // broadcast a signed tx) - unlike the other two sibling tools, network
    // access is the point, not an exception. It never touches a private key,
    // so there is nothing here for that access to put at risk.
    "connect-src https://mempool.space",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "manifest-src 'none'",
  ].join('; ');

  let html = readFileSync('index.src.html', 'utf8');
  html = html.replace('__CSP__', csp);
  html = html.replace('__CSS__', () => cssCode);
  html = html.replace('__SCRIPT__', () => scriptCode);

  writeFileSync('dist/index.html', html, 'utf8');
  writeFileSync('index.html', html, 'utf8');

  console.log(`Built index.html (${(html.length / 1024).toFixed(1)} KiB)`);
  console.log(`script-src hash: sha256-${scriptHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
