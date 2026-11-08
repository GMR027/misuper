import { useEffect } from "react";
import { Appearance, View } from "react-native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/components/theme";
import { Spinner } from "@/components/m3/feedback";
import { Compose } from "@/components/m3/host";
import { M3Text } from "@/components/m3/text";
import { initAuth, useAuth } from "@/lib/auth";
import { getSettings, useSettings, type ThemeMode } from "@/lib/settings";
import { t, useLocale } from "@/lib/i18n";

/** Back from a screen pushed over the drawer lands on the drawer's page. */
export const unstable_settings = { initialRouteName: "(drawer)" };

/**
 * Light / Dark override the phone's scheme app-wide; System hands it back.
 * Applied before the first render, so a saved theme never flashes the phone's.
 */
export function applyTheme(mode: ThemeMode) {
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
}
applyTheme(getSettings().theme);

function AppStack() {
  const { colors, scheme } = useTheme();
  const auth = useAuth();

  if (
    auth.status === "loading" ||
    (auth.status === "authenticated" && auth.user === null)
  ) {
    return <SessionLoading />;
  }

  const mustChange =
    auth.status === "authenticated" &&
    auth.user?.debe_cambiar_password === true;
  const ready = auth.status === "authenticated" && !mustChange;
  const guest = auth.status === "guest";

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(drawer)" />
        </Stack.Protected>
        <Stack.Protected guard={mustChange}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
        <Stack.Protected guard={guest}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function SessionLoading() {
  useLocale();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        backgroundColor: colors.background,
      }}
    >
      <Spinner />
      <Compose>
        <M3Text variant="body" color="muted">
          {t("common.loading")}
        </M3Text>
      </Compose>
    </View>
  );
}

/** Gesture, safe-area and theme providers over the drawer's stack. */
export default function RootLayout() {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void initAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
