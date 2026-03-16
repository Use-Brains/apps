#!/usr/bin/env node

import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const configFactory = require('../mobile/app.config.js');

for (const appEnv of ['development', 'preview', 'production']) {
  process.env.APP_ENV = appEnv;
  const config = typeof configFactory === 'function' ? configFactory({}) : configFactory;
  const bundleId = config.expo?.ios?.bundleIdentifier;
  const projectId = config.expo?.extra?.eas?.projectId ?? '';
  console.log(`${appEnv}: ${bundleId} | projectId=${projectId || '(unset)'}`);
}
