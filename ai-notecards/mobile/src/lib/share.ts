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

export function buildStudyResultShareMessage(input: { deckTitle: string; correct: number; total: number }) {
  return `I reviewed "${input.deckTitle}" on AI Notecards and got ${input.correct}/${input.total} correct.`;
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
  await Share.share({
    message: buildStudyResultShareMessage(input),
  });
}
