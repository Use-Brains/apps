import test from 'node:test';
import assert from 'node:assert/strict';

import { getSellerToolsAvailability, getSellerToolsMode } from './runtime.js';

test('getSellerToolsAvailability defaults to enabled when feature availability is absent', () => {
  const availability = getSellerToolsAvailability({
    id: 'user-1',
  });

  assert.deepEqual(availability, {
    enabled: true,
    code: null,
    message: null,
  });
});

test('getSellerToolsMode returns read-only when seller tools are disabled for this deployment', () => {
  const mode = getSellerToolsMode({
    feature_availability: {
      seller_tools: {
        enabled: false,
        code: 'SELLER_TOOLS_DISABLED',
        message: 'Seller tools are disabled in this deployment.',
      },
    },
  });

  assert.equal(mode.enabled, false);
  assert.equal(mode.readOnly, true);
  assert.equal(mode.code, 'SELLER_TOOLS_DISABLED');
  assert.match(mode.message, /disabled/i);
});
