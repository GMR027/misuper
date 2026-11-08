/** Add a recipe to a day/moment of the weekly menu. */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { getLocale, t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface Semana {
  semana: string;
  semana_fin: string;
  items: number;
  es_actual: boolean;
}

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const MOMENTS = ["desayuno", "comida", "cena", "colacion", "otro"];

function weekLabel(start: string, end: string): string {
  const locale = getLocale() === "es" ? "es-MX" : "en-US";
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(from);
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(to);
  return `${day}–${new Intl.DateTimeFormat(locale, { day: "numeric" }).format(
    to,
  )} ${month}`;
}

function todayDay(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        height: 32,
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
          color: active ? colors.onAccent : colors.foreground,
          fontSize: 12,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AddRecipeMenuSheet({
  visible,
  onClose,
  recipeId,
  recipeName,
  basePortions,
}: {
  visible: boolean;
  onClose: () => void;
  recipeId: number;
  recipeName: string;
  basePortions: number;
}) {
  useLocale();
  const { colors } = useTheme();
  const [weeks, setWeeks] = useState<Semana[]>([]);
  const [week, setWeek] = useState("");
  const [day, setDay] = useState(todayDay());
  const [moment, setMoment] = useState("comida");
  const [portions, setPortions] = useState(String(basePortions));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<Semana[]>("/api/menu/semanas");

        if (!alive) return;

        const list = Array.isArray(data) ? data : [];
        setWeeks(list);
        const current = list.find((item) => item.es_actual) ?? list[0];
        if (current) setWeek(current.semana);
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    if (saving || week === "") return;

    const value = Number(portions);
    if (!Number.isFinite(value) || value < 1) {
      setError(t("recipes.portionsInvalid"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch<unknown>("/api/menu/items", {
        method: "POST",
        body: {
          semana: week,
          dia: day,
          momento: moment,
          tipo: "receta",
          receta_id: recipeId,
          porciones: Math.round(value),
        },
      });
      showToast(
        t("recipes.menuAdded", {
          name: recipeName,
          day: t(`menu.day.${day}`),
          moment: t(`menu.moment.${moment}`),
        }),
        "success",
      );
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("recipes.addToMenu")}
      footer={
        <Button
          label={saving ? t("common.loading") : t("recipes.addToMenuAction")}
          icon="check"
          onPress={() => void save()}
          disabled={saving || week === ""}
        />
      }
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 10 }}>
          <Text
            style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}
          >
            {t("recipes.addToMenuHint")}
          </Text>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 18 }}>
              <Spinner />
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
              {t("recipes.week")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {weeks.map((item) => (
                <Chip
                  key={item.semana}
                  label={weekLabel(item.semana, item.semana_fin)}
                  active={week === item.semana}
                  onPress={() => setWeek(item.semana)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
              {t("recipes.day")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {DAYS.map((value) => (
                <Chip
                  key={value}
                  label={t(`menu.day.${value}`)}
                  active={day === value}
                  onPress={() => setDay(value)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
              {t("recipes.moment")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {MOMENTS.map((value) => (
                <Chip
                  key={value}
                  label={t(`menu.moment.${value}`)}
                  active={moment === value}
                  onPress={() => setMoment(value)}
                />
              ))}
            </View>
          </View>

          <TextField
            value={portions}
            onChangeText={setPortions}
            label={t("recipes.portions")}
            keyboardType="number"
          />

          {error ? (
            <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
          ) : null}
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
