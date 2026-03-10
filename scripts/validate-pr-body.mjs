#!/usr/bin/env node
const body = process.env.PR_BODY || '';

if (!body.trim()) {
  console.error('PR body is empty.');
  process.exit(1);
}

const laneLineMatch = body.match(/Risk Lane\s*:\s*(.+)$/im);
if (!laneLineMatch) {
  console.error('Missing or invalid "Risk Lane: A|B|C" in PR body.');
  process.exit(1);
}

const laneValue = laneLineMatch[1].trim().toUpperCase();
if (!['A', 'B', 'C'].includes(laneValue)) {
  console.error('Risk Lane must be exactly A, B, or C.');
  process.exit(1);
}

const lane = laneValue;

const featureBriefMatch = body.match(/Feature Brief\s*:\s*(.+)$/im);
if (!featureBriefMatch) {
  console.error('Missing Feature Brief line.');
  process.exit(1);
}

const featureBriefPath = featureBriefMatch[1].trim();
if (!featureBriefPath.startsWith('docs/feature-briefs/')) {
  console.error('Feature Brief path must be under docs/feature-briefs/.');
  process.exit(1);
}

if (featureBriefPath.includes('YYYY-MM-DD-feature-name')) {
  console.error('Feature Brief path still uses template placeholder.');
  process.exit(1);
}

const requiredPatterns = [
  { label: 'Gate Evidence', pattern: /Gate Evidence\s*:/i },
  { label: 'Verification Results', pattern: /Verification Results\s*:/i },
  { label: 'Residual Risks', pattern: /Residual Risks\s*:/i },
];

for (const item of requiredPatterns) {
  if (!item.pattern.test(body)) {
    console.error(`Missing required section: ${item.label}`);
    process.exit(1);
  }
}

if (lane === 'C') {
  const laneCPatterns = [
    { label: 'Smoke Test Evidence', pattern: /Smoke Test Evidence\s*:/i },
    { label: 'Rollback Plan', pattern: /Rollback Plan\s*:/i },
    { label: 'Human Sign-off', pattern: /Human Sign-off\s*:/i },
  ];

  for (const item of laneCPatterns) {
    if (!item.pattern.test(body)) {
      console.error(`Lane C requires section: ${item.label}`);
      process.exit(1);
    }
  }
}

console.log(`PR body contract valid for Lane ${lane}.`);
console.log(`lane=${lane}`);
