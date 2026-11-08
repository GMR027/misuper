import { View } from "react-native";
import { Stack } from "expo-router/stack";
import { usePathname } from "expo-router";
import { AppDock } from "@/components/app-dock";
import { ToastHost } from "@/components/toast-host";
import { useTheme } from "@/components/theme";

export default function AppLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="notas" />
        <Stack.Screen name="tickets" />
        <Stack.Screen name="gastos" />
        <Stack.Screen name="ajustes" />
      </Stack>
      <AppDock />
      <ToastHost cartBar={pathname === "/"} />
    </View>
  );
}
