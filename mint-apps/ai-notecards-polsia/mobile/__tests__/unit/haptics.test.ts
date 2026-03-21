import { beforeEach, describe, expect, it, vi } from 'vitest';

const hapticsMocks = vi.hoisted(() => ({
  selectionAsync: vi.fn(),
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
}));

vi.mock('expo-haptics', () => ({
  default: {},
  selectionAsync: hapticsMocks.selectionAsync,
  impactAsync: hapticsMocks.impactAsync,
  notificationAsync: hapticsMocks.notificationAsync,
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
}));

import { createHaptics } from '../../src/lib/haptics-core';

describe('haptics wrapper', () => {
  beforeEach(() => {
    hapticsMocks.selectionAsync.mockReset();
    hapticsMocks.impactAsync.mockReset();
    hapticsMocks.notificationAsync.mockReset();
  });

  it('does nothing when haptics are disabled', async () => {
    const haptics = createHaptics(() => false);

    await haptics.reveal();
    await haptics.answer(true);

    expect(hapticsMocks.selectionAsync).not.toHaveBeenCalled();
    expect(hapticsMocks.notificationAsync).not.toHaveBeenCalled();
  });

  it('uses selection feedback for reveal and refresh interactions', async () => {
    const haptics = createHaptics(() => true);

    await haptics.reveal();
    await haptics.refresh();

    expect(hapticsMocks.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it('uses success and error feedback for study answers', async () => {
    const haptics = createHaptics(() => true);

    await haptics.answer(true);
    await haptics.answer(false);

    expect(hapticsMocks.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(hapticsMocks.notificationAsync).toHaveBeenNthCalledWith(2, 'error');
  });
});
