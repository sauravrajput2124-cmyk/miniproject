const http = require('http');
const { spawn } = require('child_process');

console.log("Starting server in child process...");
const proc = spawn('node', ['server.js', '--no-open'], { stdio: ['pipe', 'pipe', 'pipe'] });

let serverUrl = null;

proc.stdout.on('data', (data) => {
  const text = data.toString();
  console.log("[SERVER OUT]:", text.trim());
  const match = text.match(/http:\/\/localhost:(\d+)/);
  if (match && !serverUrl) {
    serverUrl = match[0];
    runTests(serverUrl);
  }
});

proc.stderr.on('data', (data) => {
  console.error("[SERVER ERR]:", data.toString());
});

function runTests(url) {
  console.log(`\nTesting HTTP responses from ${url}...`);

  const tests = [
    { path: '/', expectedCode: 200, checkBody: (b) => b.includes('Smart EV Finder') },
    { path: '/api/health', expectedCode: 200, checkBody: (b) => b.includes('"status":"ok"') },
    { path: '/css/styles.css', expectedCode: 200, checkBody: (b) => b.includes(':root') },
    { path: '/js/data.js', expectedCode: 200, checkBody: (b) => b.includes('INITIAL_STATIONS') },
    { path: '/js/calculator.js', expectedCode: 200, checkBody: (b) => b.includes('EVCalculator') },
    { path: '/js/app.js', expectedCode: 200, checkBody: (b) => b.includes('AppState') }
  ];

  let completed = 0;

  tests.forEach((t) => {
    http.get(`${url}${t.path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const statusOk = res.statusCode === t.expectedCode;
        const bodyOk = t.checkBody(body);
        if (statusOk && bodyOk) {
          console.log(`✓ ${t.path} -> HTTP ${res.statusCode} (MIME: ${res.headers['content-type']}) [PASSED]`);
        } else {
          console.error(`✗ ${t.path} -> FAILED! Code: ${res.statusCode}, Body Match: ${bodyOk}`);
          process.exitCode = 1;
        }
        completed++;
        if (completed === tests.length) {
          console.log("\nALL SERVER HTTP TESTS PASSED! 🎉");
          proc.kill();
          process.exit(process.exitCode || 0);
        }
      });
    }).on('error', (err) => {
      console.error(`Request to ${t.path} failed:`, err);
      proc.kill();
      process.exit(1);
    });
  });
}

// Timeout safety
setTimeout(() => {
  if (!serverUrl) {
    console.error("Timeout waiting for server to start");
    proc.kill();
    process.exit(1);
  }
}, 10000);
