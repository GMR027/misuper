/** The shared frame for login, registration and forced password change. */

import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/m3/card";
import { Compose } from "@/components/m3/host";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { PageBackground, useTheme } from "@/components/theme";
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageBackground />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
      >
        <Card>
          <SymbolIcon name="shopping-cart" size={32} tint={colors.accent} />
          <M3Text variant="headline">{title}</M3Text>
          <M3Text variant="body" color="muted">
            {subtitle}
          </M3Text>
        </Card>
        {children}
        {footer ?? (
          <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <M3Text variant="caption" color="muted" align="center">
              {t("app.name")}
            </M3Text>
          </Compose>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
