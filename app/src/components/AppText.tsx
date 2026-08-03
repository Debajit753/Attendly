import React from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, TextProps, TextInputProps } from 'react-native';
import { SF_FAMILY } from '../fonts';

// Pick the SF Pro family for a style's fontWeight. Returns null if the style
// already sets a fontFamily (leave it alone).
function sfStyle(style: any) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return style;
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  return [style, { fontFamily: SF_FAMILY[w] || 'SFRegular', fontWeight: 'normal' as const }];
}

// Drop-in replacements for RN's Text / TextInput that render in SF Pro.
// Used by importing these instead of react-native's — no per-usage changes.
export const Text = React.forwardRef<any, TextProps>((props, ref) => (
  <RNText ref={ref} {...props} style={sfStyle(props.style)} />
));
export const TextInput = React.forwardRef<any, TextInputProps>((props, ref) => (
  <RNTextInput ref={ref} {...props} style={sfStyle(props.style)} />
));
