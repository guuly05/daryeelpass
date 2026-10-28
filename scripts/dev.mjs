import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const children = new Map();
let stopping = false;

function start(name, args, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: 'inherit'
  });

  children.set(name, child);
  child.on('error', (error) => {
    console.error(`[${name}] Could not start: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(name);
    if (!stopping) {
      console.error(`[${name}] stopped${signal ? ` (${signal})` : ` with exit code ${code ?? 0}`}`);
      stop(code || 1);
    }
  });
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) child.kill();
  const finish = () => process.exit(exitCode);
  if (children.size === 0) finish();
  else setTimeout(finish, 1500).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('Starting DaryeelPass web app and API. Press Ctrl+C to stop both.');
start('web', [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], root);
start('api', ['--watch', 'src/server.js'], path.join(root, 'backend'));
