import * as ExpoHaptics from 'expo-haptics';

type HapticsController = {
  reveal: () => Promise<void>;
  refresh: () => Promise<void>;
  answer: (wasCorrect: boolean) => Promise<void>;
};

export function createHaptics(isEnabled: () => boolean): HapticsController {
  async function run(task: () => Promise<void>) {
    if (!isEnabled()) {
      return;
    }

    try {
      await task();
    } catch {
      // Best-effort feedback only.
    }
  }

  return {
    reveal: () => run(() => ExpoHaptics.selectionAsync()),
    refresh: () => run(() => ExpoHaptics.selectionAsync()),
    answer: (wasCorrect: boolean) =>
      run(() =>
        ExpoHaptics.notificationAsync(
          wasCorrect
            ? ExpoHaptics.NotificationFeedbackType.Success
            : ExpoHaptics.NotificationFeedbackType.Error,
        )),
  };
}
