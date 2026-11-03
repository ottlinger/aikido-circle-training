const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function pngInfo(filename) {
  const data = fs.readFileSync(path.join(root, 'assets', filename));
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(data.toString('ascii', 12, 16), 'IHDR');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), size: data.length, colorType: data[25] };
}

test('Aiki SVG logo uses portable outlines, not installed or remote fonts', () => {
  const svg = fs.readFileSync(path.join(root, 'assets/logo.svg'), 'utf8');
  assert.match(svg, /viewBox="0 0 512 512"/);
  assert.match(svg, /Aiki – 合気/);
  assert.match(svg, /<circle /);
  assert.match(svg, /<path /);
  assert.equal(/<text\b|<image\b|<script\b|font-family|href=/.test(svg), false);
});

test('PNG logo and GitHub social preview have the correct sizes', () => {
  const logo = pngInfo('logo.png');
  assert.equal(logo.width, 512);
  assert.equal(logo.height, 512);
  assert.equal(logo.colorType, 6, 'RGBA logo supports transparent corners');
  const social = pngInfo('social-preview.png');
  assert.equal(social.width, 1280);
  assert.equal(social.height, 640);
  assert.ok(social.size < 1024 * 1024, 'GitHub social preview must be below 1 MB');
});

test('the application and favicon share the same logo asset', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<img class="brand-mark" src="assets\/logo.svg"/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/logo.svg">/);
  assert.match(html, /href="assets\/favicon.ico" sizes="16x16 32x32 48x48"/);
  assert.match(html, /href="assets\/favicon.png" sizes="32x32"/);
});

test('favicon fallbacks contain the advertised PNG and ICO resolutions', () => {
  const png = pngInfo('favicon.png');
  assert.equal(png.width, 32);
  assert.equal(png.height, 32);
  const ico = fs.readFileSync(path.join(root, 'assets/favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset + length <= ico.length);
    assert.equal(ico.readUInt32BE(offset + 16), size);
    assert.equal(ico.readUInt32BE(offset + 20), size);
  }
});

test('both READMEs show the project logo and a badge for the real test workflow', () => {
  assert.ok(fs.existsSync(path.join(root, '.github/workflows/tests.yml')));
  for (const filename of ['README.md', 'README.en.md']) {
    const readme = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.match(readme, /src="assets\/logo.png"/);
    assert.match(readme, /actions\/workflows\/tests.yml\/badge.svg\?branch=main/);
  }
});
