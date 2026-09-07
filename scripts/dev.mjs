import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('\x1b[32m%s\x1b[0m', '===============================================================');
console.log('\x1b[32m%s\x1b[0m', ' THCS Giảng Võ — School Classroom Intelligence Platform');
console.log('\x1b[36m%s\x1b[0m', ' Đang khởi chạy đồng thời Backend API & Frontend Web (1 lệnh duy nhất)...');
console.log('\x1b[90m%s\x1b[0m', ' - Backend API:  http://localhost:8080 (Health: /health)');
console.log('\x1b[90m%s\x1b[0m', ' - Frontend Web: http://localhost:5173');
console.log('\x1b[32m%s\x1b[0m', '===============================================================\n');

function runService(name, colorCode, args) {
  const child = spawn(npmCmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const prefix = `\x1b[${colorCode}m[${name}]\x1b[0m `;

  const pipeWithPrefix = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        out.write(prefix + line + '\n');
      }
    });
    stream.on('end', () => {
      if (buffer.length > 0) {
        out.write(prefix + buffer + '\n');
      }
    });
  };

  if (child.stdout) pipeWithPrefix(child.stdout, process.stdout);
  if (child.stderr) pipeWithPrefix(child.stderr, process.stderr);

  child.on('error', (err) => {
    console.error(`\x1b[31m[${name}] Error:\x1b[0m`, err);
  });

  return child;
}

const apiProcess = runService('API', '36', ['--workspace', 'apps/api', 'run', 'dev']);
const webProcess = runService('WEB', '35', ['--workspace', 'apps/web', 'run', 'dev']);

const children = [apiProcess, webProcess];

let cleaningUp = false;
function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  for (const child of children) {
    if (!child.killed && child.pid) {
      if (process.platform === 'win32') {
        try {
          spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
        } catch {}
      } else {
        try {
          child.kill('SIGTERM');
        } catch {}
      }
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});
