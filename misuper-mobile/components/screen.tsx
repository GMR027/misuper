/** A drawer page: brand/title and avatar, over a scrolling stack of content. */

import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { DotPattern, PageBackground, useTheme } from "@/components/theme";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import {
  DOCK_HEIGHT,
  HEADER_HEIGHT,
  RAIL_WIDTH,
  pageGutter,
} from "@/lib/layout";
import { useResponsive } from "@/lib/responsive";
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
  const { width, useRail, pageMaxWidth } = useResponsive();
  const auth = useAuth();
  const gutter = pageGutter(width);
  const railSpace = useRail ? RAIL_WIDTH + insets.left : 0;
  const bottomSpace = useRail
    ? insets.bottom + 16
    : insets.bottom + DOCK_HEIGHT + 24;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingLeft: railSpace,
        paddingRight: insets.right,
        paddingBottom: bottomSpace,
      }}
    >
      <PageBackground />
      <View style={{ height: HEADER_HEIGHT, overflow: "hidden" }}>
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
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: HEADER_HEIGHT,
          }}
        />
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: gutter,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.foreground,
              fontSize: 21,
              lineHeight: 27,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={openMenu}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("drawer.open")}
          >
            {auth.user ? (
              <Avatar user={auth.user} size={40} border />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surface2,
                }}
              />
            )}
          </Pressable>
        </View>
      </View>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: pageMaxWidth,
          alignSelf: "center",
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyFirst ? [0] : undefined}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: 6,
            paddingBottom: 24,
            gap: 12,
          }}
        >
          {children}
        </ScrollView>
      </View>
      {footer ? (
        <View
          style={{
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
