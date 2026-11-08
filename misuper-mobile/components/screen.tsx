/** A drawer page: brand/title and avatar, over a scrolling stack of content. */

import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { DotPattern, PageBackground, useTheme } from "@/components/theme";
import { useAuth } from "@/lib/auth";
import { DOCK_HEIGHT } from "@/lib/layout";
import { openMenu } from "@/lib/ui-store";

export function Screen({
  title,
  children,
  footer,
  stickyFirst = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  stickyFirst?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + DOCK_HEIGHT + 24,
      }}
    >
      <PageBackground />
      <View style={{ height: 60, overflow: "hidden" }}>
        <DotPattern opacity={scheme === "dark" ? 0.1 : 0.045} />
        <LinearGradient
          pointerEvents="none"
          colors={
            scheme === "dark"
              ? ["rgba(255,255,255,0.04)", "transparent"]
              : ["rgba(255,255,255,0.5)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60 }}
        />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={openMenu}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            {auth.user ? (
              <Avatar user={auth.user} size={38} border />
            ) : (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: colors.surface2,
                }}
              />
            )}
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={stickyFirst ? [0] : undefined}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 24,
          gap: 12,
        }}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
