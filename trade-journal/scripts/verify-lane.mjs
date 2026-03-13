#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const laneArg = (process.argv[2] || '').toUpperCase();
const lane = laneArg === 'A' || laneArg === 'B' || laneArg === 'C' ? laneArg : null;

if (!lane) {
  console.error('Usage: node scripts/verify-lane.mjs <A|B|C>');
  process.exit(1);
}

const run = (scriptName) => {
  console.log(`\n==> npm run ${scriptName}`);
  const result = spawnSync('npm', ['run', scriptName], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('test:unit');

if (lane === 'B' || lane === 'C') {
  run('test:integration');
  run('typecheck');
  run('lint');
}

if (lane === 'C') {
  run('test:smoke');
}

console.log('\nVerification complete.');
console.log(`Lane ${lane} automated checks passed.`);
console.log('Remember to complete manual checks required by your lane.');
