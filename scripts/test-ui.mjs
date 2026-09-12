import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    response
      .writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' })
      .end(data);
  } catch {
    response.writeHead(404).end();
  }
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(4173, '127.0.0.1', () => {
  const child = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
    { stdio: 'inherit', windowsHide: true },
  );
  child.on('error', (error) => {
    console.error(error);
    server.close();
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    server.closeAllConnections();
    server.close();
    process.exitCode = code ?? 1;
  });
});
