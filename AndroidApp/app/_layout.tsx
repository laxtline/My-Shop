import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CartProvider } from "@/lib/cart";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CartProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.brand },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Ramachandra Traders" }} />
          <Stack.Screen name="product/[slug]" options={{ title: "Product" }} />
          <Stack.Screen name="cart" options={{ title: "Your Cart" }} />
        </Stack>
      </CartProvider>
    </SafeAreaProvider>
  );
}
