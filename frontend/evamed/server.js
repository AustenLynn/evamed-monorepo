const path = require('path');
const { createApp } = require('./server/app');

createApp(path.join(__dirname, 'dist', 'evamed')).listen(process.env.PORT || 8080);
