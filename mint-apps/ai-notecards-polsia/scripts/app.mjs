#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const serverDir = path.join(root, 'server');
const mobileDir = path.join(root, 'mobile');

function fail(message) {
  console.error(`\n[app] ${message}\n`);
  process.exit(1);
}

if (!existsSync(path.join(serverDir, 'package.json'))) {
  fail('Missing server/package.json');
}

if (!existsSync(path.join(mobileDir, 'package.json'))) {
  fail('Missing mobile/package.json');
}

if (process.argv.includes('--help')) {
  console.log('Usage: npm run app');
  console.log('');
  console.log('Starts the Express API and Expo Metro in dev-client mode.');
  console.log('If the simulator dev build is not installed yet, run `npm run app:ios:simulator` once.');
  process.exit(0);
}

const children = [];

function start(name, args, cwd, extraEnv = {}) {
  const child = spawn(args[0], args.slice(1), {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[app] ${name} exited with signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.error(`[app] ${name} exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[app] Starting server and Expo dev client Metro...');
console.log('[app] If the simulator dev build is not installed yet, run `npm run app:ios:simulator` in another terminal once.');
console.log('[app] For EAS builds, set EXPO_PUBLIC_EAS_PROJECT_ID in mobile/.env.\n');

start('server', ['npm', 'run', 'dev'], serverDir);
start('mobile', ['npm', 'run', 'start:dev-client'], mobileDir, { APP_ENV: 'development' });
