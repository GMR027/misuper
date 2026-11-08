/** Material 3 filter chips: a single chip, a scrolling row and a wrapping grid. */

import { FilterChip, FlowRow, LazyRow } from "@expo/ui/jetpack-compose";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";
import { M3Text, SymbolIcon, type SymbolName } from "@/components/m3/text";

export interface ChipOption<T extends string | number | null> {
  value: T;
  label: string;
  icon?: SymbolName;
}

/** One selectable chip. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: SymbolName;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Compose>
      <FilterChip
        selected={selected}
        enabled={!disabled}
        onClick={onPress}
        colors={{
          containerColor: colors.surface2,
          labelColor: colors.foreground,
          iconColor: colors.foreground,
          selectedContainerColor: colors.accent,
          selectedLabelColor: colors.onAccent,
          selectedLeadingIconColor: colors.onAccent,
          selectedTrailingIconColor: colors.onAccent,
        }}
        border={{ width: selected ? 0 : 1, color: colors.border }}
      >
        <FilterChip.Label>
          <M3Text variant="label" color={null} maxLines={1}>
            {label}
          </M3Text>
        </FilterChip.Label>
        {icon ? (
          <FilterChip.LeadingIcon>
            <SymbolIcon name={icon} size={18} />
          </FilterChip.LeadingIcon>
        ) : null}
      </FilterChip>
    </Compose>
  );
}

/** A single-choice row that scrolls sideways. */
export function ChipRow<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <LazyRow horizontalArrangement={{ spacedBy: 8 }}>
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            icon={option.icon}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </LazyRow>
    </Compose>
  );
}

/** A wrapping grid of chips, for the categories sheet. */
export function ChipGrid<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <FlowRow
        horizontalArrangement={{ spacedBy: 8 }}
        verticalArrangement={{ spacedBy: 8 }}
      >
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            icon={option.icon}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </FlowRow>
    </Compose>
  );
}
