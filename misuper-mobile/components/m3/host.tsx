/**
 * A Jetpack Compose root in the app's Material 3 theme (seeded with the
 * accent, in the scheme Ajustes picked). Every Compose element lives under
 * one, either as its own `Host` (a card) or inside a larger tree.
 */

import { createContext, type ReactNode, use } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Host, RNHostView } from "@expo/ui/jetpack-compose";
import { useTheme } from "@/components/theme";

const InCompose = createContext(false);

/** Whether the element being drawn sits inside a Compose tree. */
export function useInCompose(): boolean {
  return use(InCompose);
}

export function M3Host({
  children,
  style,
  matchContents = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  matchContents?: boolean | { vertical?: boolean; horizontal?: boolean };
}) {
  const { colors, scheme } = useTheme();
  return (
    <Host
      matchContents={matchContents}
      colorScheme={scheme}
      seedColor={colors.accent}
      style={style}
    >
      <InCompose value>{children}</InCompose>
    </Host>
  );
}

/** A Compose element wherever it is used: as is inside Compose, else in its own Host. */
export function Compose({
  children,
  style,
  matchContents = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  matchContents?: boolean | { vertical?: boolean; horizontal?: boolean };
}) {
  if (useInCompose()) return children;
  return (
    <M3Host style={style} matchContents={matchContents}>
      {children}
    </M3Host>
  );
}

/** React Native content inside a Compose tree (`RNHostView`). */
export function NativeContent({
  children,
  wrap = false,
}: {
  children: ReactNode;
  wrap?: boolean;
}) {
  return (
    <RNHostView matchContents={wrap ? true : { vertical: true }}>
      <InCompose value={false}>{children}</InCompose>
    </RNHostView>
  );
}
