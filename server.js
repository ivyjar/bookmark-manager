// Web server for the bookmark manager, built with Express. Start it with `npm start`,
// then open the address it prints. It serves the files in the public/ folder to the browser.
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();

// Send any file in public/ when the browser asks for it ("/" gives index.html).
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log('Bookmark manager running at http://localhost:' + PORT);
  console.log('Press Ctrl+C to stop.');
});
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE'
    ? 'Port ' + PORT + ' is already in use. Try: PORT=3001 npm start'
    : err.message);
  process.exit(1);
});
