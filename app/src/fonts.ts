// SF Pro font files (bundled from /Library/Fonts — personal project use).
export const SF_FONTS = {
  SFRegular: require('../assets/fonts/SFRegular.otf'),
  SFMedium: require('../assets/fonts/SFMedium.otf'),
  SFSemibold: require('../assets/fonts/SFSemibold.otf'),
  SFBold: require('../assets/fonts/SFBold.otf'),
  SFHeavy: require('../assets/fonts/SFHeavy.otf'),
};

// fontWeight → the matching SF Pro family (each weight is a separate file).
export const SF_FAMILY: Record<string, string> = {
  '100': 'SFRegular', '200': 'SFRegular', '300': 'SFRegular', '400': 'SFRegular', normal: 'SFRegular',
  '500': 'SFMedium',
  '600': 'SFSemibold',
  '700': 'SFBold', bold: 'SFBold',
  '800': 'SFHeavy', '900': 'SFHeavy',
};
