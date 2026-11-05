import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/lib/theme";
import { SOCIAL_URLS, SOCIAL_LABELS } from "@shared/social";

const SOCIAL_ICONS: Record<keyof typeof SOCIAL_URLS, string> = {
  instagram: "📷",
  facebook: "📘",
  youtube: "📺",
  googleMaps: "🗺️",
  whatsapp: "💬",
};

export function Footer() {
  const links = Object.keys(SOCIAL_URLS).filter((key) => {
    const href = SOCIAL_URLS[key as keyof typeof SOCIAL_URLS];
    if (!href) return false;
    try {
      const url = new URL(href);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }) as (keyof typeof SOCIAL_URLS)[];

  if (links.length === 0) return null;

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Silently fail if can't open
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconsContainer}>
        {links.map((key) => (
          <Pressable
            key={key}
            onPress={() => openLink(SOCIAL_URLS[key])}
            style={styles.iconButton}
            accessibilityLabel={SOCIAL_LABELS[key]}
          >
            <Text style={styles.iconText}>{SOCIAL_ICONS[key]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  iconsContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  iconButton: {
    padding: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: {
    fontSize: 20,
  },
});