/** The API's five base units as a row of small selectable pills. */

import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/components/theme";

export const UNITS = ["kg", "gr", "L", "ml", "pza"] as const;

export type Unit = (typeof UNITS)[number];

export function UnitPicker({
  value,
  onChange,
  includeTaste = false,
}: {
  value: string;
  onChange: (unit: string) => void;
  includeTaste?: boolean;
}) {
  const { colors } = useTheme();
  const units: string[] = includeTaste ? [...UNITS, "al_gusto"] : [...UNITS];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {units.map((unit) => {
        const active = unit === value;
        return (
          <Pressable
            key={unit}
            onPress={() => onChange(unit)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              height: 32,
              minWidth: 46,
              paddingHorizontal: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
              backgroundColor: active ? colors.accent : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: active ? colors.onAccent : colors.muted,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {unit === "al_gusto" ? "al gusto" : unit}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
