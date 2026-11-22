import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CartProvider } from "@/lib/cart";
import { BrandProvider } from "@/context/BrandContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { colors } from "@/lib/theme";
import { openSansAssets, openSansStyle } from "@/lib/fonts";
import { FontsLoadedContext } from "@/components/ui/Typography";
import { usePushToken } from "@/hooks/usePushToken";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(openSansAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <FontsLoadedContext.Provider value={fontsLoaded}>
      <SafeAreaProvider>
        <CartProvider>
          <BrandProvider>
            <AuthProvider>
              <AppNavigator fontsLoaded={fontsLoaded} />
            </AuthProvider>
          </BrandProvider>
        </CartProvider>
      </SafeAreaProvider>
    </FontsLoadedContext.Provider>
  );
}

function AppNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { user } = useAuth();
  usePushToken(user?.id);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: "#fff",
          headerTitleStyle: openSansStyle("700", "normal", fontsLoaded),
          headerBackTitleStyle: openSansStyle("400", "normal", fontsLoaded),
          headerLargeTitleStyle: openSansStyle("700", "normal", fontsLoaded),
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Ramachandra Traders" }} />
        <Stack.Screen name="product/[slug]" options={{ title: "Product" }} />
        <Stack.Screen name="cart" options={{ title: "Your Cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="track/[id]" options={{ title: "Track Order" }} />
        <Stack.Screen name="account" options={{ title: "My Account" }} />
        <Stack.Screen name="account/addresses" options={{ title: "Saved Addresses" }} />
        <Stack.Screen name="orders" options={{ title: "My Orders" }} />
        <Stack.Screen name="orders/[id]" options={{ title: "Order Details" }} />
      </Stack>
    </>
  );
}

