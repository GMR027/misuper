/** The web's appearance card: 15 palettes, light/dark/system and focus glow. */

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Slider } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { Compose } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { useTheme, type ThemeMode } from "@/components/theme";
import { t, useLocale } from "@/lib/i18n";
import { PALETTES, PALETTE_IDS } from "@/lib/palettes";
import { setSettings, useSettings } from "@/lib/settings";

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "settings.themeSystem" },
  { value: "light", label: "settings.themeLight" },
  { value: "dark", label: "settings.themeDark" },
];

export function AppearanceEditor() {
  useLocale();
  const { colors } = useTheme();
  const mode = useSettings((s) => s.theme);
  const palette = useSettings((s) => s.palette);
  const focusColor = useSettings((s) => s.focusColor);
  const focusIntensity = useSettings((s) => s.focusIntensity);
  const focusSpread = useSettings((s) => s.focusSpread);
  const [custom, setCustom] = useState(() =>
    focusColor === "auto" ? "" : focusColor,
  );
  const [customError, setCustomError] = useState(false);

  const applyCustom = () => {
    const value = custom.trim();

    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      setCustomError(true);
      return;
    }

    setCustomError(false);
    setSettings({ focusColor: value.toLowerCase() });
  };

  return (
    <View style={card(colors)}>
      <Text style={title(colors)}>{t("settings.appearance")}</Text>
      <Text style={caption(colors)}>{t("settings.appearanceHint")}</Text>

      <Text style={caption(colors)}>{t("settings.theme")}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {MODES.map((option) => {
          const active = mode === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSettings({ theme: option.value })}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 9,
                borderRadius: 12,
                backgroundColor: active ? colors.accent : colors.surface2,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text
                style={{
                  color: active ? colors.onAccent : colors.muted,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {t(option.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={caption(colors)}>{t("settings.palette")}</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 8,
        }}
      >
        {PALETTE_IDS.map((id) => {
          const active = palette === id;
          const swatch = PALETTES[id].swatch;
          return (
            <Pressable
              key={id}
              onPress={() => setSettings({ palette: id })}
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 8,
                borderRadius: 12,
                backgroundColor: active ? colors.accentContainer : colors.surface2,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <LinearGradient
                colors={[swatch[0], swatch[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: colors.surface,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 11,
                    height: 11,
                    borderRadius: 6,
                    backgroundColor: swatch[2],
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                />
                {active ? (
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    ✓
                  </Text>
                ) : null}
              </LinearGradient>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: active ? colors.onAccentContainer : colors.foreground,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {t(`palettes.${id}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={caption(colors)}>{t("settings.focusColor")}</Text>
      <Text style={caption(colors)}>{t("settings.focusHint")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => setSettings({ focusColor: "auto" })}
          style={focusPill(focusColor === "auto", colors)}
        >
          <LinearGradient
            colors={[colors.accentMark, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 22, height: 22, borderRadius: 11 }}
          />
          <Text
            style={{
              color:
                focusColor === "auto"
                  ? colors.onAccent
                  : colors.foreground,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {t("settings.focusAuto")}
          </Text>
        </Pressable>
        {PALETTE_IDS.map((id) => {
          const value = PALETTES[id].light.accentMark.toLowerCase();
          const active = focusColor.toLowerCase() === value;
          return (
            <Pressable
              key={id}
              onPress={() => setSettings({ focusColor: value })}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: value,
                borderWidth: active ? 3 : 1,
                borderColor: active ? colors.foreground : colors.border,
              }}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={custom}
            onChangeText={(value) => {
              setCustom(value);
              setCustomError(false);
            }}
            label={t("settings.focusCustom")}
            placeholder="#14b8a6"
            keyboardType="text"
          />
        </View>
        <Pressable
          onPress={applyCustom}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: colors.accent,
          }}
        >
          <Text
            style={{ color: colors.onAccent, fontSize: 12, fontWeight: "700" }}
          >
            {t("settings.apply")}
          </Text>
        </Pressable>
      </View>
      {customError ? (
        <Text style={{ color: colors.error, fontSize: 11 }}>
          {t("settings.focusInvalid")}
        </Text>
      ) : null}

      <Text style={caption(colors)}>
        {t("settings.focusIntensity", { value: focusIntensity })}
      </Text>
      <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Slider
          value={focusIntensity}
          min={0}
          max={200}
          colors={{
            thumbColor: colors.accent,
            activeTrackColor: colors.accent,
            inactiveTrackColor: colors.surface4,
          }}
          onValueChange={(value) =>
            setSettings({ focusIntensity: Math.round(value) })
          }
          modifiers={[fillMaxWidth()]}
        />
      </Compose>

      <Text style={caption(colors)}>
        {t("settings.focusSpread", { value: focusSpread })}
      </Text>
      <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Slider
          value={focusSpread}
          min={50}
          max={250}
          colors={{
            thumbColor: colors.accent,
            activeTrackColor: colors.accent,
            inactiveTrackColor: colors.surface4,
          }}
          onValueChange={(value) =>
            setSettings({ focusSpread: Math.round(value) })
          }
          modifiers={[fillMaxWidth()]}
        />
      </Compose>
    </View>
  );
}

// Imported here so the appearance card stays a single component.

function card(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  } as const;
}

function title(colors: ReturnType<typeof useTheme>["colors"]) {
  return { color: colors.foreground, fontSize: 16, fontWeight: "700" } as const;
}

function caption(colors: ReturnType<typeof useTheme>["colors"]) {
  return { color: colors.muted, fontSize: 12 } as const;
}

function focusPill(
  active: boolean,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: active ? colors.accent : colors.surface2,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.border,
  };
}
