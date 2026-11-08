/** Material 3 text fields, drawn with Jetpack Compose. */

import {
  OutlinedTextField,
  useNativeState,
  type TextFieldKeyboardType,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import type { ModifierConfig } from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";
import { M3Text, SymbolIcon, type SymbolName } from "@/components/m3/text";

/** An outlined text field with a floating label and a placeholder. */
export function TextField({
  value,
  onChangeText,
  label,
  placeholder,
  keyboardType = "text",
  secure = false,
  leadingIcon,
  prefix,
  suffix,
  multiline = false,
  minLines,
  maxLines,
  modifiers,
}: {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  placeholder?: string;
  keyboardType?:
    | "text"
    | "uri"
    | "email"
    | "number"
    | "decimal"
    | "password";
  secure?: boolean;
  leadingIcon?: SymbolName;
  prefix?: string;
  suffix?: string;
  multiline?: boolean;
  minLines?: number;
  maxLines?: number;
  modifiers?: ModifierConfig[];
}) {
  // Captured once: the field owns what is typed, and onChangeText mirrors it.
  const state = useNativeState(value);
  const { colors } = useTheme();
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <OutlinedTextField
        value={state}
        onValueChange={onChangeText}
        singleLine={!multiline}
        minLines={minLines}
        maxLines={maxLines}
        visualTransformation={secure ? "password" : "none"}
        keyboardOptions={{
          keyboardType: (secure ? "password" : keyboardType) as TextFieldKeyboardType,
          autoCorrectEnabled: false,
          capitalization: "none",
        }}
        colors={{
          focusedTextColor: colors.foreground,
          unfocusedTextColor: colors.foreground,
          focusedContainerColor: "transparent",
          unfocusedContainerColor: "transparent",
          cursorColor: colors.accent,
          focusedIndicatorColor: colors.accent,
          unfocusedIndicatorColor: colors.border,
          focusedLabelColor: colors.accent,
          unfocusedLabelColor: colors.muted,
          focusedPlaceholderColor: colors.muted,
          unfocusedPlaceholderColor: colors.muted,
        }}
        modifiers={modifiers ?? [fillMaxWidth()]}
      >
        <OutlinedTextField.Label>
          <M3Text variant="caption" color={null}>
            {label}
          </M3Text>
        </OutlinedTextField.Label>
        {leadingIcon ? (
          <OutlinedTextField.LeadingIcon>
            <SymbolIcon name={leadingIcon} size={20} />
          </OutlinedTextField.LeadingIcon>
        ) : null}
        {prefix ? (
          <OutlinedTextField.Prefix>
            <M3Text variant="body" color="muted">
              {prefix}
            </M3Text>
          </OutlinedTextField.Prefix>
        ) : null}
        {suffix ? (
          <OutlinedTextField.Suffix>
            <M3Text variant="body" color="muted">
              {suffix}
            </M3Text>
          </OutlinedTextField.Suffix>
        ) : null}
        {placeholder ? (
          <OutlinedTextField.Placeholder>
            <M3Text variant="body" color="muted">
              {placeholder}
            </M3Text>
          </OutlinedTextField.Placeholder>
        ) : null}
      </OutlinedTextField>
    </Compose>
  );
}
