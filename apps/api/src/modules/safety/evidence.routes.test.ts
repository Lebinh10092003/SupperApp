import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readSingleFile } from './evidence.routes.js';

/**
 * Test riêng cho `readSingleFile` (phần multipart parsing tự viết cho route
 * này) — KHÔNG cần bucket Storage thật, vì phần `validateAndStoreEvidence`
 * (gọi SAU khi có buffer) đã có test riêng đầy đủ ở `evidence.test.ts`.
 * Dựng 1 HTTP server thật (không qua Express) để có `IncomingMessage` thật,
 * gửi multipart THẬT qua `fetch`/`FormData` — không mock req.pipe/busboy.
 */

async function withServer(handler: (req: http.IncomingMessage) => Promise<unknown>, run: (url: string) => Promise<void>) {
  const server = http.createServer((req, res) => {
    handler(req)
      .then((result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      })
      .catch((e) => {
        res.writeHead(500);
        res.end(String(e));
      });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('readSingleFile: đọc đúng buffer + mimeType + filename của 1 file thật', async () => {
  await withServer(
    (req) => readSingleFile(req as never),
    async (url) => {
      const form = new FormData();
      const content = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
      form.append('file', new Blob([content], { type: 'image/jpeg' }), 'test.jpg');
      const res = await fetch(url, { method: 'POST', body: form });
      const body = await res.json();
      assert.equal(body.rejected, false);
      assert.equal(body.filename, 'test.jpg');
      assert.equal(body.mimeType, 'image/jpeg');
      assert.deepEqual(Object.values(body.buffer.data ?? body.buffer), [...content]);
    }
  );
});

test('readSingleFile: không gửi file nào -> rejected no_file', async () => {
  await withServer(
    (req) => readSingleFile(req as never),
    async (url) => {
      const form = new FormData();
      form.append('notAFile', 'hello');
      const res = await fetch(url, { method: 'POST', body: form });
      const body = await res.json();
      assert.equal(body.rejected, true);
      assert.equal(body.reason, 'no_file');
    }
  );
});

test('readSingleFile: file vượt quá ngưỡng kích thước lớn nhất trong 3 loại -> rejected file_too_large', async () => {
  await withServer(
    (req) => readSingleFile(req as never),
    async (url) => {
      const form = new FormData();
      // Ngưỡng lớn nhất hiện tại là video 50MB — gửi 51MB để chắc chắn vượt.
      const bigContent = new Uint8Array(51 * 1024 * 1024);
      form.append('file', new Blob([bigContent], { type: 'video/mp4' }), 'big.mp4');
      const res = await fetch(url, { method: 'POST', body: form });
      const body = await res.json();
      assert.equal(body.rejected, true);
      assert.equal(body.reason, 'file_too_large');
    }
  );
});
