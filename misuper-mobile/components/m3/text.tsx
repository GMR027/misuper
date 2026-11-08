/** Compose text in Material 3's type scale, and Material Symbols as Compose icons. */

import type { ColorValue } from "react-native";
import { Icon, Text, type TextProps } from "@expo/ui/jetpack-compose";
import type { ModifierConfig } from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import {
  SYMBOLS,
  type SymbolName,
} from "@/components/m3/symbols.generated";

export type { SymbolName };

type TextStyle = NonNullable<TextProps["style"]>;

const TYPE_SCALE = {
  display: "displaySmall",
  headline: "headlineSmall",
  title: "titleLarge",
  subtitle: "titleMedium",
  label: "labelLarge",
  body: "bodyMedium",
  caption: "bodySmall",
} as const satisfies Record<string, TextStyle["typography"]>;

export type TextVariant = keyof typeof TYPE_SCALE;

/** A theme ink by name, or any colour. */
export type Ink =
  | "foreground"
  | "muted"
  | "accent"
  | "onAccent"
  | "error"
  | (string & {});

export function useInk(ink: Ink | null | undefined): string | undefined {
  const { colors } = useTheme();
  if (ink == null) return undefined;
  if (ink === "foreground") return colors.foreground;
  if (ink === "muted") return colors.muted;
  if (ink === "accent") return colors.accent;
  if (ink === "onAccent") return colors.onAccent;
  if (ink === "error") return colors.error;
  return ink;
}

export function M3Text({
  children,
  variant = "body",
  color = "foreground",
  weight,
  maxLines,
  align,
  modifiers,
}: {
  children: string | number | (string | number)[];
  variant?: TextVariant;
  /** null: the content colour around it (a button's, a list item's). */
  color?: Ink | null;
  weight?: TextStyle["fontWeight"];
  maxLines?: number;
  align?: TextStyle["textAlign"];
  modifiers?: ModifierConfig[];
}) {
  const ink = useInk(color);
  return (
    <Text
      color={ink}
      maxLines={maxLines}
      overflow={maxLines ? "ellipsis" : undefined}
      modifiers={modifiers}
      style={{
        typography: TYPE_SCALE[variant],
        fontWeight: weight,
        textAlign: align,
      }}
    >
      {Array.isArray(children) ? children.join("") : String(children)}
    </Text>
  );
}

/** A Material Symbol in Compose; `tint` left out inherits the content colour. */
export function SymbolIcon({
  name,
  size = 24,
  tint,
  label,
  modifiers,
}: {
  name: SymbolName;
  size?: number;
  tint?: ColorValue;
  label?: string;
  modifiers?: ModifierConfig[];
}) {
  return (
    <Icon
      source={SYMBOLS[name]}
      size={size}
      tint={tint}
      contentDescription={label}
      modifiers={modifiers}
    />
  );
}
