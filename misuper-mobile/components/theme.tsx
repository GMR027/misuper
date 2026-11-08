/**
 * The app's colours and the theme React Native draws with. Compose trees get
 * the same accent as their Material 3 seed (`M3Host`), so both halves of a
 * screen agree. The 15 palettes mirror the web's `palettes.css`.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  Image,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { PALETTES, type PaletteColors, type PaletteId } from "@/lib/palettes";
import { useSettings, type ThemeMode } from "@/lib/settings";

export interface ThemeColors extends PaletteColors {
  success: string;
  warning: string;
  error: string;
  onError: string;
}

export interface Theme {
  scheme: "light" | "dark";
  palette: PaletteId;
  colors: ThemeColors;
  /** The colour of the soft background halo (the web's focus colour). */
  focusColor: string;
  focusIntensity: number;
  focusSpread: number;
}

const SUCCESS = { light: "#2e7d32", dark: "#7fd48a" } as const;
const WARNING = { light: "#9a6500", dark: "#f0b45a" } as const;
const ERROR = { light: "#ba1a1a", dark: "#ffb4ab" } as const;
const ON_ERROR = { light: "#ffffff", dark: "#690005" } as const;

const ThemeContext = createContext<Theme | null>(null);

/** Follows Ajustes (palette, system/light/dark, focus colour) and the phone. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSettings((s) => s.theme);
  const palette = useSettings((s) => s.palette);
  const focusSetting = useSettings((s) => s.focusColor);
  const focusIntensity = useSettings((s) => s.focusIntensity);
  const focusSpread = useSettings((s) => s.focusSpread);
  const system = useColorScheme();
  const scheme: "light" | "dark" =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const theme = useMemo<Theme>(() => {
    const base = PALETTES[palette][scheme];
    const focusColor =
      focusSetting === "auto" ? base.accentMark : focusSetting;

    return {
      scheme,
      palette,
      colors: {
        ...base,
        success: SUCCESS[scheme],
        warning: WARNING[scheme],
        error: ERROR[scheme],
        onError: ON_ERROR[scheme],
        accentMark: focusColor,
      },
      focusColor,
      focusIntensity,
      focusSpread,
    };
  }, [scheme, palette, focusSetting, focusIntensity, focusSpread]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/** The active theme; falls back to light esmeralda when no provider is mounted. */
export function useTheme(): Theme {
  return (
    useContext(ThemeContext) ?? {
      scheme: "light",
      palette: "esmeralda",
      colors: {
        ...PALETTES.esmeralda.light,
        success: SUCCESS.light,
        warning: WARNING.light,
        error: ERROR.light,
        onError: ON_ERROR.light,
      },
      focusColor: PALETTES.esmeralda.light.accentMark,
      focusIntensity: 100,
      focusSpread: 100,
    }
  );
}

/**
 * The soft colour halo behind a page, like the web's focus glow. It is
 * decorative, never intercepts touches, and follows the selected palette,
 * focus colour and intensity/spread.
 */
export function PageBackground() {
  const { scheme, colors, focusColor, focusIntensity, focusSpread } = useTheme();
  const { width, height } = useWindowDimensions();
  const strength = focusIntensity / 100;
  const spread = focusSpread / 100;
  const dotTint = scheme === "dark" ? "#ffffff" : "#000000";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      />

      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={focusColor} stopOpacity={0.15 * strength} />
            <Stop offset="0.55" stopColor={focusColor} stopOpacity={0.06 * strength} />
            <Stop offset="1" stopColor={focusColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={width * 0.08}
          cy={-height * 0.12}
          r={width * 0.9 * spread}
          fill="url(#halo)"
        />
        <Circle
          cx={width * 1.02}
          cy={height * 0.04}
          r={width * 0.75 * spread}
          fill="url(#halo)"
        />
        <Circle
          cx={width * 0.5}
          cy={height * 1.12}
          r={width * 0.6 * spread}
          fill="url(#halo)"
        />
      </Svg>

      <Image
        source={require("@/assets/textures/dots.png")}
        resizeMode="repeat"
        tintColor={dotTint}
        style={[
          StyleSheet.absoluteFill,
          { opacity: scheme === "dark" ? 0.12 : 0.055 },
        ]}
      />
      <Image
        source={require("@/assets/textures/grain.png")}
        resizeMode="repeat"
        tintColor={scheme === "dark" ? "#ffffff" : "#000000"}
        style={[
          StyleSheet.absoluteFill,
          { opacity: scheme === "dark" ? 0.1 : 0.2 },
        ]}
      />
    </View>
  );
}

/** The web's dot grid, reusable on bars and cards. */
export function DotPattern({
  opacity,
  tint,
}: {
  opacity?: number;
  tint?: string;
}) {
  const { scheme } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={require("@/assets/textures/dots.png")}
        resizeMode="repeat"
        tintColor={tint ?? (scheme === "dark" ? "#ffffff" : "#000000")}
        style={[
          StyleSheet.absoluteFill,
          { opacity: opacity ?? (scheme === "dark" ? 0.12 : 0.055) },
        ]}
      />
    </View>
  );
}

export type { ThemeMode };
