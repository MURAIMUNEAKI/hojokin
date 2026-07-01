const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8002;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API Proxy Endpoint (Handle both Node style and PHP style for local dev)
    if (pathname === '/api/proxy' || pathname === '/proxy.php') {
        const targetUrl = parsedUrl.query.url;

        if (!targetUrl || !targetUrl.startsWith('https://api.jgrants-portal.go.jp/')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid URL' }));
            return;
        }

        const headers = {
            'User-Agent': 'Node.js Proxy'
        };

        // Forward necessary headers
        if (req.headers['accept']) headers['Accept'] = req.headers['accept'];
        if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

        // Forward API Key if present
        if (req.headers['x-api-key']) {
            headers['X-API-KEY'] = req.headers['x-api-key'];
        }

        https.get(targetUrl, { headers }, (apiRes) => {
            res.writeHead(apiRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://tobutoptours.ai'
            });
            apiRes.pipe(res);
        }).on('error', (e) => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        });
        return;
    }

    // Static File Serving
    let filePath = '.' + pathname;
    if (filePath === './') filePath = './index.html';

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
