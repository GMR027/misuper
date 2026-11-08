/** Material 3 buttons and icon buttons, drawn with Jetpack Compose. */

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Button as ComposeButton,
  ElevatedButton,
  FilledIconButton,
  FilledTonalButton,
  FilledTonalIconButton,
  FlowRow,
  IconButton as ComposeIconButton,
  OutlinedButton,
  OutlinedIconButton,
  Row,
  Spacer,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  border,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size as sizeModifier,
  type ModifierConfig,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";
import { M3Text, SymbolIcon, type SymbolName } from "@/components/m3/text";

export type ButtonVariant =
  | "filled"
  | "tonal"
  | "outlined"
  | "text"
  | "elevated";

const BUTTONS = {
  filled: ComposeButton,
  tonal: FilledTonalButton,
  outlined: OutlinedButton,
  text: TextButton,
  elevated: ElevatedButton,
};

/** A Material 3 button with an optional leading symbol. Draws its own Host outside Compose. */
export function Button({
  label,
  onPress,
  variant = "filled",
  icon,
  disabled = false,
  modifiers,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: SymbolName;
  disabled?: boolean;
  modifiers?: ModifierConfig[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const Component = BUTTONS[variant];
  const filled = variant === "filled";
  const contentColor = filled ? colors.onAccent : undefined;
  return (
    <Compose style={style}>
      <Component
        onClick={onPress}
        enabled={!disabled}
        colors={
          filled
            ? { containerColor: colors.accent, contentColor: colors.onAccent }
            : undefined
        }
      >
        {icon ? (
          <>
            <SymbolIcon
              name={icon}
              size={18}
              tint={filled ? contentColor : undefined}
            />
            <Spacer modifiers={[width(8)]} />
          </>
        ) : null}
        <M3Text variant="label" color={filled ? null : undefined}>
          {label}
        </M3Text>
      </Component>
    </Compose>
  );
}

export type IconButtonVariant = "standard" | "filled" | "tonal" | "outlined";

const ICON_BUTTONS = {
  standard: ComposeIconButton,
  filled: FilledIconButton,
  tonal: FilledTonalIconButton,
  outlined: OutlinedIconButton,
};

/** A Material 3 icon button holding a Material Symbol. `label` is what a screen reader says. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = "standard",
  disabled = false,
  size = 40,
  iconSize = 24,
  color,
  style,
}: {
  icon: SymbolName;
  label: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  disabled?: boolean;
  size?: number;
  iconSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const Component = ICON_BUTTONS[variant];
  return (
    <Compose style={style}>
      <Component
        onClick={onPress}
        enabled={!disabled}
        colors={
          variant === "filled"
            ? { containerColor: colors.accent, contentColor: colors.onAccent }
            : color
              ? { contentColor: color }
              : undefined
        }
        modifiers={[sizeModifier(size, size)]}
      >
        <SymbolIcon name={icon} size={iconSize} label={label} />
      </Component>
    </Compose>
  );
}

/**
 * A row of buttons that wraps whole (`FlowRow`): a button that no longer fits
 * moves to the next line instead of squeezing its label.
 */
export function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <FlowRow
        horizontalArrangement={{ spacedBy: 8 }}
        verticalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth()]}
      >
        {children}
      </FlowRow>
    </Compose>
  );
}

/** A compact pill for dense cards: the web's small "Agregar" button. */
export function CompactButton({
  label,
  icon,
  onPress,
  variant = "filled",
  disabled = false,
  modifiers,
}: {
  label: string;
  icon?: SymbolName;
  onPress: () => void;
  variant?: "filled" | "tonal" | "outlined";
  disabled?: boolean;
  modifiers?: ModifierConfig[];
}) {
  const { colors } = useTheme();
  const filled = variant === "filled";
  const container = filled
    ? colors.accent
    : variant === "tonal"
      ? colors.accentContainer
      : colors.surface;
  const content = filled
    ? colors.onAccent
    : variant === "tonal"
      ? colors.onAccentContainer
      : colors.foreground;

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement="center"
      modifiers={[
        height(34),
        clip(Shapes.Material.Pill),
        background(container),
        ...(variant === "outlined"
          ? [border(1, colors.border)]
          : []),
        padding(10, 0, 10, 0),
        ...(disabled ? [alpha(0.45)] : [clickable(onPress)]),
        ...(modifiers ?? []),
      ]}
    >
      {icon ? (
        <>
          <SymbolIcon name={icon} size={16} tint={content} />
          <Spacer modifiers={[width(4)]} />
        </>
      ) : null}
      <M3Text variant="caption" weight="700" color={content} maxLines={1}>
        {label}
      </M3Text>
    </Row>
  );
}

/** A full-width stack of pick-one buttons (Ajustes: theme, language). */
export function ChoiceButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ButtonRow>
      {options.map((option) => (
        <Button
          key={option.value}
          label={option.label}
          variant={option.value === value ? "filled" : "outlined"}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ButtonRow>
  );
}


