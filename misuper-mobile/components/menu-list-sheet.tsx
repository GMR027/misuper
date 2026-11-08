/** Turn a weekly menu into a shopping list, with an optional item filter. */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import type { MenuPreview } from "@/lib/menu";
import { ingredientUnit } from "@/lib/recipes";
import { showToast } from "@/lib/toast";

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

export function MenuListSheet({
  visible,
  week,
  onClose,
  onDone,
}: {
  visible: boolean;
  week: string;
  onClose: () => void;
  onDone?: (listId: number) => void;
}) {
  useLocale();
  const { colors } = useTheme();
  const [preview, setPreview] = useState<MenuPreview | null>(null);
  const [lists, setLists] = useState<ListaResumen[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<"new" | number>("new");
  const [name, setName] = useState(t("menu.listDefaultName", { week }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const [previewData, listsData] = await Promise.all([
          apiFetch<MenuPreview>("/api/menu/lista/preview", {
            method: "POST",
            body: { semana: week },
          }),
          apiFetch<ListsResponse>("/api/listas-compra"),
        ]);

        if (!alive) return;

        setPreview(previewData);
        setSelected(previewData.items.map((item) => item.clave));
        setLists(Array.isArray(listsData.items) ? listsData.items : []);
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [week]);

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
      const excluded = preview.items
        .filter((item) => !selected.includes(item.clave))
        .map((item) => item.clave);

      const body: Record<string, unknown> = {
        semana: week,
        excluir: excluded,
      };

      if (target === "new") body.nombre = name.trim();
      else body.lista_id = target;

      const data = await apiFetch<{ lista: { id: number }; agregados: number }>(
        "/api/menu/lista",
        { method: "POST", body },
      );

      showToast(
        t("menu.listCreated", { count: data.agregados ?? selected.length }),
        "success",
      );
      onDone?.(data.lista.id);
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
      title={t("menu.generateList")}
      footer={
        <Button
          label={saving ? t("common.loading") : t("menu.generateListAction")}
          icon="check"
          onPress={() => void save()}
          disabled={saving || loading || preview === null}
        />
      }
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {t("menu.generateListHint")}
          </Text>

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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    flex: 1,
                    color: colors.foreground,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {t("recipes.listPreviewCount", {
                    count: preview.items.length,
                  })}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {formatCurrency(preview.costo?.total ?? 0)}
                </Text>
              </View>

              {preview.items.map((item) => {
                const active = selected.includes(item.clave);
                const unit = ingredientUnit(item.unidad_base);
                const unitLabel = unit.startsWith("recipes.")
                  ? t(unit)
                  : unit;

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
                          fontSize: 9.5,
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
