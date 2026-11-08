/** Material 3 cards: the surface every group of content sits on. */

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Card as FilledCard,
  Column,
  ElevatedCard,
  HorizontalDivider,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";

/**
 * A filled (default) or elevated card, one Compose tree: its children are
 * Compose elements (M3Text, buttons, rows), laid out with a 16 dp pad.
 */
export function Card({
  children,
  elevated = false,
  style,
}: {
  children: ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const Component = elevated ? ElevatedCard : FilledCard;
  return (
    <Compose
      matchContents={{ vertical: true }}
      style={[{ width: "100%" }, style]}
    >
      <Component
        colors={{
          containerColor: colors.surface,
          contentColor: colors.foreground,
        }}
        modifiers={[fillMaxWidth()]}
      >
        <Column
          verticalArrangement={{ spacedBy: 10 }}
          modifiers={[padding(16, 16, 16, 16)]}
        >
          {children}
        </Column>
      </Component>
    </Compose>
  );
}

/** Material 3's hairline between groups, inside a card or on a screen. */
export function Divider() {
  const { colors } = useTheme();
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <HorizontalDivider
        color={colors.border}
        modifiers={[fillMaxWidth()]}
      />
    </Compose>
  );
}
