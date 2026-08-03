import Constants from 'expo-constants';

// Bulletproof Expo Go detection (appOwnership === 'expo' is the canonical check).
// Native-only modules (geofencing, notifications) must never load in Expo Go.
export const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';
