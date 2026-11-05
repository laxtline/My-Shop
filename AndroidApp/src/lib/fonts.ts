import { Platform, type TextStyle } from "react-native";

// Static require calls let Metro include every face in the offline app bundle.
export const openSansAssets = {
  "OpenSans-Light": require("../../assets/fonts/OpenSans-Light.ttf"),
  "OpenSans-Regular": require("../../assets/fonts/OpenSans-Regular.ttf"),
  "OpenSans-Medium": require("../../assets/fonts/OpenSans-Medium.ttf"),
  "OpenSans-SemiBold": require("../../assets/fonts/OpenSans-SemiBold.ttf"),
  "OpenSans-Bold": require("../../assets/fonts/OpenSans-Bold.ttf"),
  "OpenSans-ExtraBold": require("../../assets/fonts/OpenSans-ExtraBold.ttf"),
  "OpenSans-LightItalic": require("../../assets/fonts/OpenSans-LightItalic.ttf"),
  "OpenSans-RegularItalic": require("../../assets/fonts/OpenSans-RegularItalic.ttf"),
  "OpenSans-MediumItalic": require("../../assets/fonts/OpenSans-MediumItalic.ttf"),
  "OpenSans-SemiBoldItalic": require("../../assets/fonts/OpenSans-SemiBoldItalic.ttf"),
  "OpenSans-BoldItalic": require("../../assets/fonts/OpenSans-BoldItalic.ttf"),
  "OpenSans-ExtraBoldItalic": require("../../assets/fonts/OpenSans-ExtraBoldItalic.ttf"),
};

const faces: Record<number, string> = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
};

const webFallback = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const systemFont = Platform.select({ ios: "System", android: "sans-serif", default: webFallback });

type FontWeight = Extract<TextStyle["fontWeight"], string>;
type FontStyle = Pick<TextStyle, "fontFamily" | "fontStyle"> & { fontWeight: FontWeight };

export function openSansStyle(
  weight: TextStyle["fontWeight"] = "400",
  style: TextStyle["fontStyle"] = "normal",
  loaded = true,
): FontStyle {
  if (!loaded) {
    return { fontFamily: systemFont, fontWeight: String(weight) as FontWeight, fontStyle: style };
  }

  const numericWeight = weight === "bold" ? 700 : weight === "normal" ? 400 : Number(weight);
  const nearestWeight = Math.min(800, Math.max(300, Math.round((numericWeight || 400) / 100) * 100));
  const family = `OpenSans-${faces[nearestWeight]}${style === "italic" ? "Italic" : ""}`;

  return {
    fontFamily: Platform.OS === "web" ? `"${family}", ${webFallback}` : family,
    // The selected file already has the weight/style. Reset these so Android
    // does not synthesize bold or look for a different, unregistered face.
    fontWeight: "normal",
    fontStyle: "normal",
  };
}
