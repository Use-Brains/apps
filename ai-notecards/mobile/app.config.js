const ENVIRONMENTS = {
  development: {
    appName: 'AI Notecards Dev',
    bundleId: process.env.IOS_BUNDLE_ID_DEV ?? 'com.ainotecards.dev',
    associatedDomains: [],
    usesAppleSignIn: false,
  },
  preview: {
    appName: 'AI Notecards Preview',
    bundleId: process.env.IOS_BUNDLE_ID_PREVIEW ?? 'com.ainotecards.preview',
    associatedDomains: ['applinks:ainotecards.com'],
    usesAppleSignIn: true,
  },
  production: {
    appName: 'AI Notecards',
    bundleId: process.env.IOS_BUNDLE_ID_PRODUCTION ?? 'com.ainotecards.app',
    associatedDomains: ['applinks:ainotecards.com'],
    usesAppleSignIn: true,
  },
};

module.exports = () => {
  const appEnv = process.env.APP_ENV ?? 'development';

  if (!ENVIRONMENTS[appEnv]) {
    throw new Error(
      `Unsupported APP_ENV "${appEnv}". Expected one of: ${Object.keys(ENVIRONMENTS).join(', ')}`,
    );
  }

  const current = ENVIRONMENTS[appEnv];
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '';
  const plugins = [
    'expo-router',
    'expo-secure-store',
    'expo-image-picker',
    'expo-notifications',
    '@react-native-google-signin/google-signin',
    'expo-sqlite',
  ];

  if (current.usesAppleSignIn) {
    plugins.splice(1, 0, 'expo-apple-authentication');
  }

  return {
    expo: {
      name: current.appName,
      slug: 'ai-notecards',
      version: '0.1.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      scheme: appEnv === 'production' ? 'ai-notecards' : `ai-notecards-${appEnv}`,
      userInterfaceStyle: 'automatic',
      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#FAF7F2',
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: current.bundleId,
        associatedDomains: current.associatedDomains,
        usesAppleSignIn: current.usesAppleSignIn,
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false,
        },
      },
      android: {
        adaptiveIcon: {
          backgroundColor: '#FAF7F2',
          foregroundImage: './assets/adaptive-icon.png',
        },
        package:
          appEnv === 'production'
            ? 'com.ainotecards.app'
            : `com.ainotecards.${appEnv}`,
      },
      web: {
        favicon: './assets/favicon.png',
        bundler: 'metro',
      },
      plugins,
      extra: {
        appEnv,
        apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api',
        router: {},
        eas: {
          projectId: easProjectId,
        },
      },
      owner: 'blue-expos-organization',
    },
  };
};
