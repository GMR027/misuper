/** Turn several selected recipes into one shopping list. */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatQuantity } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import { ingredientUnit } from "@/lib/recipes";
import { showToast } from "@/lib/toast";

interface Selection {
  slug: string;
  nombre: string;
  porcionesBase: number;
}

interface PreviewItem {
  clave: string;
  producto_id: number | null;
  nombre: string;
  cantidad: number;
  unidad_base: string;
  categoria_nombre: string | null;
  principal: boolean;
  basico: boolean;
  ya_comprado: boolean;
  origen: string;
}

interface PreviewResponse {
  items: PreviewItem[];
  recetas: { slug: string; nombre: string; porciones: number }[];
  total: number;
}

interface ListaResumen {
  id: number;
  nombre: string;
  items_count: number;
  pendientes: number;
}

interface ListsResponse {
  items: ListaResumen[];
  pendientes: number;
}

export function MultiRecipeListSheet({
  visible,
  onClose,
  selections,
}: {
  visible: boolean;
  onClose: () => void;
  selections: Selection[];
}) {
  useLocale();
  const { colors } = useTheme();
  const [portions, setPortions] = useState<Record<string, number>>(() =>
    Object.fromEntries(selections.map((item) => [item.slug, item.porcionesBase])),
  );
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [lists, setLists] = useState<ListaResumen[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<"new" | number>("new");
  const [name, setName] = useState(t("recipes.multiListName"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void Promise.all([
        apiFetch<PreviewResponse>("/api/recetas/preview-lista", {
          method: "POST",
          body: {
            recetas: selections.map((item) => ({
              slug: item.slug,
              porciones: portions[item.slug] ?? item.porcionesBase,
            })),
          },
        }),
        apiFetch<ListsResponse>("/api/listas-compra"),
      ])
        .then(([previewData, listsData]) => {
          if (!alive) return;
          setPreview(previewData);
          setSelected(previewData.items.map((item) => item.clave));
          setLists(Array.isArray(listsData.items) ? listsData.items : []);
        })
        .catch((caught) => {
          if (alive) setError(apiErrorMessage(caught));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [portions, selections]);

  const changePortions = (slug: string, delta: number) => {
    setPortions((current) => ({
      ...current,
      [slug]: Math.max(1, Math.min(50, (current[slug] ?? 1) + delta)),
    }));
  };

  const toggle = (key: string) => {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  };

  const save = async () => {
    if (saving || preview === null) return;

    if (selected.length === 0) {
      setError(t("recipes.listEmptySelection"));
      return;
    }

    if (target === "new" && name.trim().length === 0) {
      setError(t("recipes.listNameRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let listId: number;

      if (target === "new") {
        const created = await apiFetch<{ id: number }>("/api/listas-compra", {
          method: "POST",
          body: { nombre: name.trim() },
        });
        listId = created.id;
      } else {
        listId = target;
      }

      const items = preview.items.filter((item) => selected.includes(item.clave));

      await apiFetch<unknown>(`/api/listas-compra/${listId}/items`, {
        method: "POST",
        body: {
          items: items.map((item) => ({
            producto_id: item.producto_id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            unidad_base: item.unidad_base,
            origen: t("recipes.fromRecipe", { name: item.origen ?? "" }),
          })),
        },
      });

      showToast(t("recipes.listAdded", { count: items.length }), "success");
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const targetChips: { key: string; label: string; value: "new" | number }[] = [
    { key: "new", label: t("recipes.newList"), value: "new" },
    ...lists.map((list) => ({
      key: `list-${list.id}`,
      label: `${list.nombre} (${list.items_count})`,
      value: list.id,
    })),
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("recipes.multiTitle", { count: selections.length })}
      footer={
        <Button
          label={saving ? t("common.loading") : t("recipes.addToListAction")}
          icon="check"
          onPress={() => void save()}
          disabled={saving || loading || preview === null}
        />
      }
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {t("recipes.multiHint")}
          </Text>

          {selections.map((item) => (
            <View
              key={item.slug}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {item.nombre}
              </Text>
              <Pressable
                onPress={() => changePortions(item.slug, -1)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.foreground, fontSize: 16 }}>−</Text>
              </Pressable>
              <Text
                style={{
                  minWidth: 24,
                  textAlign: "center",
                  color: colors.foreground,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {portions[item.slug] ?? item.porcionesBase}
              </Text>
              <Pressable
                onPress={() => changePortions(item.slug, 1)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.onAccent, fontSize: 16 }}>+</Text>
              </Pressable>
            </View>
          ))}

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 18 }}>
              <Spinner />
            </View>
          ) : null}

          {error ? (
            <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
          ) : null}

          {preview ? (
            <>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {t("recipes.listPreviewCount", { count: preview.items.length })}
              </Text>

              {preview.items.map((item) => {
                const active = selected.includes(item.clave);
                const unit = ingredientUnit(item.unidad_base);
                const unitLabel = unit.startsWith("recipes.") ? t(unit) : unit;

                return (
                  <Pressable
                    key={item.clave}
                    onPress={() => toggle(item.clave)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                      paddingVertical: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.accent : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active ? (
                        <Text
                          style={{
                            color: colors.onAccent,
                            fontSize: 12,
                            fontWeight: "900",
                            lineHeight: 14,
                          }}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.foreground,
                          fontSize: 12.5,
                          fontWeight: "600",
                        }}
                      >
                        {item.nombre}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                        {`${formatQuantity(item.cantidad)} ${unitLabel}`}
                        {item.ya_comprado
                          ? ` · ${t("recipes.alreadyBought")}`
                          : ""}
                      </Text>
                    </View>
                    {item.principal ? (
                      <Text
                        style={{
                          color: colors.accent,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {t("recipes.mainIngredient")}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}

              <View style={{ gap: 6, paddingTop: 4 }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 10.5,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {t("recipes.listTarget")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                  {targetChips.map((chip) => {
                    const active = target === chip.value;
                    return (
                      <Pressable
                        key={chip.key}
                        onPress={() => setTarget(chip.value)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: active ? colors.accent : colors.border,
                          backgroundColor: active
                            ? colors.accent
                            : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: active
                              ? colors.onAccent
                              : colors.foreground,
                            fontSize: 11.5,
                            fontWeight: active ? "700" : "500",
                          }}
                        >
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {target === "new" ? (
                <TextField
                  value={name}
                  onChangeText={setName}
                  label={t("recipes.listName")}
                />
              ) : null}
            </>
          ) : null}
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
