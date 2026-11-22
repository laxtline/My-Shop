// Dynamic Expo config. app.json holds the static defaults; environment
// variables override the values that differ between local development,
// preview builds and the production store builds.
//
//   EXPO_PUBLIC_API_URL              https://api.your-shop.in
//   EXPO_PUBLIC_STOREFRONT_URL       https://your-shop.in
//   EXPO_PUBLIC_GOOGLE_CLIENT_ID     web/Expo client id (used by expo-auth-session)
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID iOS OAuth client id (adds the URL scheme)
//   EAS_PROJECT_ID                   from `eas init`
const base = require("./app.json");

module.exports = ({ config }) => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || base.expo.extra.apiUrl;
  const storefrontUrl = process.env.EXPO_PUBLIC_STOREFRONT_URL || base.expo.extra.storefrontUrl;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

  const reversedIosClientId = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
    : null;

  const iosSchemes = ["ramachandra", ...(reversedIosClientId ? [reversedIosClientId] : [])];

  return {
    ...base.expo,
    ...config,
    ios: {
      ...base.expo.ios,
      ...(config.ios || {}),
      infoPlist: {
        ...(base.expo.ios.infoPlist || {}),
        ...((config.ios && config.ios.infoPlist) || {}),
        CFBundleURLTypes: [{ CFBundleURLSchemes: iosSchemes }],
      },
    },
    extra: {
      ...base.expo.extra,
      ...(config.extra || {}),
      apiUrl,
      storefrontUrl,
      eas: {
        ...(base.expo.extra.eas || {}),
        ...((config.extra && config.extra.eas) || {}),
        ...(process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : {}),
      },
    },
  };
};
