import { createContext, forwardRef, useContext } from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { openSansStyle } from "@/lib/fonts";

export const FontsLoadedContext = createContext(false);
const InheritedTextStyle = createContext<TextStyle>({});

/** Use these primitives for all app copy, button labels and form fields. */
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const loaded = useContext(FontsLoadedContext);
  const inherited = useContext(InheritedTextStyle);
  const flattened = { ...inherited, ...StyleSheet.flatten(style) };
  const typography = { fontWeight: flattened.fontWeight, fontStyle: flattened.fontStyle };

  return (
    <InheritedTextStyle.Provider value={typography}>
      <NativeText
        {...props}
        ref={ref}
        style={[style, openSansStyle(typography.fontWeight, typography.fontStyle, loaded)]}
      />
    </InheritedTextStyle.Provider>
  );
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const loaded = useContext(FontsLoadedContext);
  const flattened = StyleSheet.flatten(style);

  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={[style, openSansStyle(flattened?.fontWeight, flattened?.fontStyle, loaded)]}
    />
  );
});
