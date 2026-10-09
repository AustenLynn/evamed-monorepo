const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { cacheControlFor, createApp } = require('./app');

const IMMUTABLE = 'public, max-age=31536000, immutable';

test('fingerprinted build files are immutable', () => {
  for (const file of ['main-XKXL4GGQ.js', 'chunk-2wA4XfdU.js', 'chunk-a_b-CdE1.js', 'styles-EZC76LTV.css', 'media/Uso_-AB12cd34.png']) {
    assert.equal(cacheControlFor(file), IMMUTABLE, file);
  }
});

test('everything else is revalidated', () => {
  for (const file of ['index.html', 'favicon.ico', '3rdpartylicenses.txt', 'assets/map/2.jpg', 'assets/files/EVAMED_WINDOWS.xlsm', 'assets/images/Icon awesome-file-download.png']) {
    assert.equal(cacheControlFor(file), 'no-cache', file);
  }
});

test('the server sends those headers, including for the SPA fallback', async t => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'evamed-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>app</html>');
  fs.writeFileSync(path.join(dist, 'main-ABCD1234.js'), 'console.log(1)');
  fs.mkdirSync(path.join(dist, 'assets', 'images'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'assets', 'images', 'Icon awesome-file-download.png'), 'png');

  const server = createApp(dist).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const js = await fetch(`${base}/main-ABCD1234.js`);
  assert.equal(js.status, 200);
  assert.equal(js.headers.get('cache-control'), IMMUTABLE);

  for (const route of ['/', '/materials-stage/update']) {
    const page = await fetch(`${base}${route}`);
    assert.equal(page.status, 200, route);
    assert.equal(await page.text(), '<html>app</html>', route);
    assert.equal(page.headers.get('cache-control'), 'no-cache', route);
  }

  const asset = await fetch(`${base}/assets/images/Icon%20awesome-file-download.png`);
  assert.equal(asset.headers.get('cache-control'), 'no-cache');
});
