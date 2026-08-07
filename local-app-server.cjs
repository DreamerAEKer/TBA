const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 8765;
const ROOT = path.resolve('C:\\Users\\Admin\\.gemini\\antigravity\\scratch');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.pdf': 'application/pdf'
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache'
    });
    res.end(body);
}

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname);
    } catch (_) {
        return send(res, 400, 'Invalid URL');
    }

    if (pathname === '/health') return send(res, 200, 'TBA Local App Launcher is running');
    if (pathname === '/help' || pathname === '/') {
        return send(res, 200, '<!doctype html><meta charset="utf-8"><title>TBA Local App Launcher</title><style>body{font:18px system-ui;max-width:720px;margin:60px auto;padding:24px;line-height:1.7}code{background:#eee;padding:3px 7px;border-radius:6px}</style><h1>TBA Local App Launcher</h1><p>ตัวช่วยเปิดแอปในเครื่องกำลังทำงานแล้ว</p><p>กลับไปที่หน้า TBA แล้วกดเรียกใช้งานอีกครั้งได้เลย</p>', 'text/html; charset=utf-8');
    }

    const requestedPath = path.resolve(ROOT, `.${pathname}`);
    const relative = path.relative(ROOT, requestedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return send(res, 403, 'Access denied');
    }

    fs.stat(requestedPath, (statError, stats) => {
        if (statError || !stats.isFile()) return send(res, 404, 'File not found');
        const contentType = MIME_TYPES[path.extname(requestedPath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(requestedPath).pipe(res);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`TBA Local App Launcher: http://${HOST}:${PORT}`);
    console.log(`Serving: ${ROOT}`);
    console.log('Keep this window open while using local apps from TBA.');
});

server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. The launcher may already be running.`);
    } else {
        console.error(error.message);
    }
    process.exit(1);
});
