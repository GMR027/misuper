/** A paper-textured card for the React Native half of the app. */

import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DotPattern, useTheme } from "@/components/theme";

export function TextureCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, scheme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <DotPattern opacity={scheme === "dark" ? 0.1 : 0.045} />
      <LinearGradient
        pointerEvents="none"
        colors={
          scheme === "dark"
            ? ["rgba(255,255,255,0.05)", "transparent"]
            : ["rgba(255,255,255,0.6)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }}
      />
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}
