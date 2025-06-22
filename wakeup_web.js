const express = require('express');
const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const weblistPath = path.join(__dirname, 'weblist.txt');
const logBuffer = [];
const MAX_LOG_LINES = 100;
const interval = 5 * 60 * 1000; // 5 minutes

// In-memory start time (no persistence)
const bootTime = new Date();

// Helper for formatting
function pad(n) {
  return n.toString().padStart(2, '0');
}

function log(message) {
  console.log(message);
  logBuffer.push(message);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
}

async function checkWebsites(page) {
  const now = new Date();
  const nowStr = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;

  console.log("🔁 Wake loop triggered");

  try {
    const urls = fs.readFileSync(weblistPath, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    for (const url of urls) {
      try {
        await page.goto(url, { timeout: 15000 });
        log(`${nowStr} ✅ ${url} → 200`);
      } catch (err) {
        log(`${nowStr} ❌ ${url} → Error: ${err.message}`);
      }
    }
  } catch (err) {
    log(`${nowStr} ❌ weblist.txt not found or error reading.`);
  }
}

async function wakeWeb() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log("🚀 Puppeteer launched. Starting loop...");

  await checkWebsites(page);
  setInterval(() => checkWebsites(page), interval);
}

app.get('/', (req, res) => {
  const uptimeSec = Math.floor((Date.now() - bootTime.getTime()) / 1000);
  const hours = pad(Math.floor(uptimeSec / 3600));
  const minutes = pad(Math.floor((uptimeSec % 3600) / 60));
  const seconds = pad(uptimeSec % 60);
  const timeString = `${hours}:${minutes}:${seconds}`;

  res.send(`
    <html>
      <head>
        <title>Wake Web</title>
        <meta http-equiv="refresh" content="1">
      </head>
      <body style="font-family: monospace; padding: 20px;">
        <h2>Wake Web Service (Node.js)</h2>
        <p>⏱️ Web running since: <code>${timeString}</code></p>
        <h3>Request Log (last ${MAX_LOG_LINES} entries)</h3>
        <pre style="background:#f5f5f5; padding:10px; border:1px solid #ccc; height:400px; overflow:auto;">
${logBuffer.join('\n')}
        </pre>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`🌐 Server running at http://localhost:${port}`);
  wakeWeb();
});
