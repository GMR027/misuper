/** The shared frame for login, registration and forced password change. */

import { useEffect, useRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/m3/card";
import { Compose } from "@/components/m3/host";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { PageBackground, useTheme } from "@/components/theme";
import { pageGutter } from "@/lib/layout";
import { useResponsive } from "@/lib/responsive";
import { t } from "@/lib/i18n";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  /** Landscape phones can already hold the brand card beside the form. */
  const useTwoPane = width >= 700;
  const gutter = Math.max(
    pageGutter(width),
    insets.left,
    insets.right,
  );
  const scroll = useRef<ScrollView>(null);

  /** Rotation changes the layout: start the form at the top again. */
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [width]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageBackground />
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: insets.top + 24,
          paddingLeft: gutter,
          paddingRight: gutter,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: useTwoPane ? 1040 : 440,
            alignSelf: "center",
            flexDirection: useTwoPane ? "row" : "column",
            alignItems: useTwoPane ? "center" : "stretch",
            gap: useTwoPane ? 32 : 16,
          }}
        >
          <View style={{ flex: useTwoPane ? 1 : undefined, width: "100%" }}>
            <Card>
              <SymbolIcon name="shopping-cart" size={32} tint={colors.accent} />
              <M3Text variant="headline">{title}</M3Text>
              <M3Text variant="body" color="muted">
                {subtitle}
              </M3Text>
            </Card>
          </View>
          <View
            style={{
              flex: useTwoPane ? 1 : undefined,
              width: "100%",
              gap: 16,
            }}
          >
            {children}
            {footer ?? (
              <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
                <M3Text variant="caption" color="muted" align="center">
                  {t("app.name")}
                </M3Text>
              </Compose>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
