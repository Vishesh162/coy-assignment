import { spawn } from 'node:child_process';

const server = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start',
  '--hostname', '0.0.0.0', '--port', process.env.PORT || '3107',
], { stdio: 'inherit', windowsHide: true });

server.on('exit', code => { process.exitCode = code ?? 1; });
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
