/** Material 3 list rows: a headline, a supporting line and a leading/trailing slot. */

import type { ReactNode } from "react";
import type { ColorValue } from "react-native";
import {
  Column,
  Row,
  Switch as ComposeSwitch,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  clickable,
  fillMaxWidth,
  padding,
  weight,
  type ModifierConfig,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";
import { M3Text, type Ink } from "@/components/m3/text";

/**
 * Android's preference row. `leading` and `trailing` are Compose elements
 * (a SymbolIcon, a switch); the row ripples when it has an `onPress`.
 */
export function ListRow({
  title,
  summary,
  onPress,
  disabled = false,
  leading,
  trailing,
  titleColor,
  modifiers: extraModifiers = [],
}: {
  title: string;
  summary?: string;
  onPress?: () => void;
  disabled?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  titleColor?: Ink;
  modifiers?: ModifierConfig[];
}) {
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[
          fillMaxWidth(),
          padding(0, 10, 0, 10),
          ...(onPress && !disabled ? [clickable(onPress)] : []),
          ...(disabled ? [alpha(0.5)] : []),
          ...extraModifiers,
        ]}
      >
        {leading}
        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
          <M3Text variant="body" weight="500" color={titleColor} maxLines={1}>
            {title}
          </M3Text>
          {summary ? (
            <M3Text variant="caption" color="muted">
              {summary}
            </M3Text>
          ) : null}
        </Column>
        {trailing}
      </Row>
    </Compose>
  );
}

/** A label and its value, aligned to the two ends of the row. */
export function ValueRow({
  label,
  value,
  valueColor = "foreground",
}: {
  label: string;
  value: string;
  valueColor?: Ink;
}) {
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), padding(0, 4, 0, 4)]}
      >
        <M3Text variant="body" color="muted" modifiers={[weight(1)]}>
          {label}
        </M3Text>
        <M3Text variant="body" weight="500" color={valueColor}>
          {value}
        </M3Text>
      </Row>
    </Compose>
  );
}

/** A setting that is on or off: the whole row toggles its switch. */
export function SwitchRow({
  title,
  summary,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  summary?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const switchColors: {
    checkedThumbColor?: ColorValue;
    checkedTrackColor?: ColorValue;
    uncheckedThumbColor?: ColorValue;
    uncheckedTrackColor?: ColorValue;
  } = {
    checkedThumbColor: colors.onAccent,
    checkedTrackColor: colors.accent,
    uncheckedThumbColor: colors.muted,
    uncheckedTrackColor: colors.surface2,
  };
  return (
    <ListRow
      title={title}
      summary={summary}
      onPress={() => onChange(!value)}
      disabled={disabled}
      trailing={
        <ComposeSwitch
          value={value}
          enabled={!disabled}
          onCheckedChange={onChange}
          colors={switchColors}
        />
      }
    />
  );
}
