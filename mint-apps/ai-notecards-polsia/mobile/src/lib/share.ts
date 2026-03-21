import { Platform, Share } from 'react-native';
import Constants from 'expo-constants';

function getPublicWebUrl() {
  const webUrl =
    Constants.expoConfig?.extra?.webUrl ??
    process.env.EXPO_PUBLIC_WEB_URL ??
    'https://ainotecards.com';

  return String(webUrl).replace(/\/+$/, '');
}

export function buildMarketplaceSharePayload(input: { id: string; title: string; sellerName?: string | null }) {
  const url = `${getPublicWebUrl()}/marketplace/${input.id}`;
  const sellerLine = input.sellerName ? `Seller: ${input.sellerName}\n` : '';

  return {
    message: `${input.title}\n${sellerLine}${url}`.trim(),
    url,
  };
}

function buildScoreBar(correct: number, total: number): string {
  const filled = Math.round((correct / total) * 5);
  return '🟩'.repeat(filled) + '⬜'.repeat(5 - filled);
}

export function buildStudyResultShareMessage(input: { deckTitle: string; correct: number; total: number }) {
  const pct = Math.round((input.correct / input.total) * 100);
  const bar = buildScoreBar(input.correct, input.total);
  const medal = pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '📚';
  return [
    `${medal} AI Notecards`,
    `"${input.deckTitle}"`,
    ``,
    `${bar}`,
    `${input.correct}/${input.total} correct · ${pct}%`,
    ``,
    getPublicWebUrl(),
  ].join('\n');
}

export async function shareMarketplaceListing(input: { id: string; title: string; sellerName?: string | null }) {
  const payload = buildMarketplaceSharePayload(input);
  await Share.share(Platform.select({
    ios: {
      message: payload.message,
      url: payload.url,
    },
    default: {
      message: payload.message,
    },
  }) ?? { message: payload.message });
}

export async function shareStudyResult(input: { deckTitle: string; correct: number; total: number }) {
  const message = buildStudyResultShareMessage(input);
  const url = getPublicWebUrl();
  await Share.share(
    Platform.select({
      ios: { message, url },
      default: { message },
    }) ?? { message },
  );
}
