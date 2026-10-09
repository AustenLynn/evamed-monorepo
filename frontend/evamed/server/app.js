// Serves the built Angular app. Angular fingerprints its bundles and media
// (main-XKXL4GGQ.js, media/Uso-AB12cd34.png), so those never change under the
// same name and can be cached for good. index.html and assets/ keep their
// names across deploys, so browsers must revalidate them.
const express = require('express');
const path = require('path');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const FINGERPRINTED = /-[A-Za-z0-9_-]{8}\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/;

function cacheControlFor(relativePath) {
  const file = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  // assets/ is copied as-is; a name like "Icon awesome-file-download.png" only looks hashed.
  if (!file.startsWith('assets/') && FINGERPRINTED.test(file)) {
    return IMMUTABLE;
  }
  return 'no-cache';
}

function createApp(distDir) {
  const app = express();
  app.use(
    express.static(distDir, {
      setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', cacheControlFor(path.relative(distDir, filePath)));
      },
    })
  );
  app.get('/*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
  return app;
}

module.exports = { cacheControlFor, createApp };
