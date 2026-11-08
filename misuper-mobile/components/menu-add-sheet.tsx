/** Add or replace a recipe/note in one day/meal of the weekly menu. */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { Spinner } from "@/components/m3/feedback";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import {
  recipeQuery,
  readSelectedPurchases,
  type RecetaFiltros,
  type RecetaResumen,
  type RecetasResponse,
} from "@/lib/recipes";
import type { MenuItem } from "@/lib/menu";
import { showToast } from "@/lib/toast";

type Tab = "receta" | "nota";

const TIMES = [15, 30, 45, 60];

function FilterChip({
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
      style={{
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accent : "transparent",
      }}
    >
      <Text
        style={{
          color: active ? colors.onAccent : colors.muted,
          fontSize: 10.5,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MenuAddSheet({
  visible,
  onClose,
  week,
  day,
  moment,
  onAdded,
  replaceItem = null,
}: {
  visible: boolean;
  onClose: () => void;
  week: string;
  day: number;
  moment: string;
  onAdded: () => void;
  replaceItem?: MenuItem | null;
}) {
  useLocale();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("receta");
  const [query, setQuery] = useState("");
  const [favoritas, setFavoritas] = useState(false);
  const [soloDespensa, setSoloDespensa] = useState(false);
  const [tiempo, setTiempo] = useState<number | null>(null);
  const [results, setResults] = useState<RecetaResumen[]>([]);
  const [searching, setSearching] = useState(true);
  const [selected, setSelected] = useState<RecetaResumen | null>(null);
  const [portions, setPortions] = useState("4");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "receta") return;

    let alive = true;
    const timer = setTimeout(() => {
      setSearching(true);
      const filters: RecetaFiltros = {
        q: query,
        categoria: "",
        tipo: "",
        tiempo,
        favoritas,
        soloDespensa,
        compras: soloDespensa ? readSelectedPurchases() : [],
      };

      void apiFetch<RecetasResponse>(`/api/recetas${recipeQuery(filters)}`)
        .then((data) => {
          if (alive) setResults((data.items ?? []).slice(0, 40));
        })
        .catch(() => {
          if (alive) setResults([]);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, query.trim() === "" ? 0 : 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, tab, favoritas, soloDespensa, tiempo]);

  const pick = (recipe: RecetaResumen) => {
    setSelected(recipe);
    setPortions(String(recipe.porciones_base));
    setError(null);
  };

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      if (tab === "receta" || replaceItem !== null) {
        if (selected === null) {
          setError(t("menu.pickRecipe"));
          return;
        }

        const value = Number(portions);
        const porciones = Number.isFinite(value)
          ? Math.max(1, Math.round(value))
          : 1;

        if (replaceItem) {
          await apiFetch<unknown>(`/api/menu/items/${replaceItem.id}`, {
            method: "PUT",
            body: {
              receta_id: selected.id,
              porciones,
              dia: replaceItem.dia,
              momento: replaceItem.momento,
            },
          });
          showToast(t("menu.recipeReplaced"), "success");
        } else {
          await apiFetch<unknown>("/api/menu/items", {
            method: "POST",
            body: {
              semana: week,
              dia: day,
              momento: moment,
              tipo: "receta",
              receta_id: selected.id,
              porciones,
            },
          });
          showToast(t("menu.recipeAdded"), "success");
        }
      } else {
        if (note.trim().length < 2) {
          setError(t("menu.noteRequired"));
          return;
        }

        await apiFetch<unknown>("/api/menu/items", {
          method: "POST",
          body: {
            semana: week,
            dia: day,
            momento: moment,
            tipo: "nota",
            nota: note.trim(),
          },
        });
        showToast(t("menu.noteAdded"), "success");
      }

      onAdded();
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const title = replaceItem
    ? t("menu.replaceTitle", { name: replaceItem.nombre })
    : `${t("menu.addTo")} ${t(`menu.day.${day}`)} · ${t(
        `menu.moment.${moment}`,
      )}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          label={
            saving
              ? t("common.loading")
              : replaceItem
                ? t("menu.replaceAction")
                : t("menu.addAction")
          }
          icon="check"
          onPress={() => void save()}
          disabled={saving}
        />
      }
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
          {replaceItem === null ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["receta", "nota"] as Tab[]).map((value) => {
                const active = tab === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setTab(value);
                      setError(null);
                    }}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 9,
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
                        fontWeight: "700",
                      }}
                    >
                      {value === "receta" ? t("menu.recipe") : t("menu.note")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === "receta" || replaceItem !== null ? (
            <>
              <TextField
                value={query}
                onChangeText={setQuery}
                label={t("recipes.search")}
                placeholder={t("recipes.searchPlaceholder")}
                leadingIcon="search"
              />

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <FilterChip
                  label={t("recipes.favorites")}
                  active={favoritas}
                  onPress={() => setFavoritas((value) => !value)}
                />
                <FilterChip
                  label={t("recipes.pantryOnly")}
                  active={soloDespensa}
                  onPress={() => setSoloDespensa((value) => !value)}
                />
                {TIMES.map((value) => (
                  <FilterChip
                    key={value}
                    label={t("recipes.minutesShort", { count: value })}
                    active={tiempo === value}
                    onPress={() => setTiempo(tiempo === value ? null : value)}
                  />
                ))}
              </View>

              {searching ? (
                <View style={{ alignItems: "center", paddingVertical: 10 }}>
                  <Spinner />
                </View>
              ) : null}

              {results.map((recipe) => {
                const active = selected?.id === recipe.id;
                return (
                  <Pressable
                    key={recipe.slug}
                    onPress={() => pick(recipe)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 7,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: active
                        ? colors.accentContainer
                        : "transparent",
                    }}
                  >
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.foreground,
                          fontSize: 12.5,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {recipe.nombre}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 10 }}>
                        {`${t("recipes.minutes", {
                          count: recipe.tiempo_min,
                        })} · ${t("recipes.portionsCount", {
                          count: recipe.porciones_base,
                        })}`}
                      </Text>
                    </View>
                    {active ? (
                      <Text
                        style={{
                          color: colors.accent,
                          fontSize: 15,
                          fontWeight: "800",
                        }}
                      >
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}

              {selected ? (
                <TextField
                  value={portions}
                  onChangeText={setPortions}
                  label={t("recipes.portions")}
                  keyboardType="number"
                />
              ) : null}
            </>
          ) : (
            <TextField
              value={note}
              onChangeText={setNote}
              label={t("menu.note")}
              placeholder={t("menu.notePlaceholder")}
              multiline
              minLines={4}
              maxLines={8}
            />
          )}

          {error ? (
            <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
          ) : null}
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
