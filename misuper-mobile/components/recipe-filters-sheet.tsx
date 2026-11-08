/** Recipe filters: categories, diet types, time, favorites and pantry. */

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { NativeContent } from "@/components/m3/host";
import { useTheme } from "@/components/theme";
import { t } from "@/lib/i18n";
import {
  EMPTY_RECIPE_FILTERS,
  type RecetaCategoria,
  type RecetaFiltros,
  type RecetaTipo,
} from "@/lib/recipes";

const TIMES = [15, 30, 45, 60];

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
        minHeight: 32,
        paddingHorizontal: 11,
        paddingVertical: 6,
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
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 7, paddingHorizontal: 16, paddingTop: 12 }}>
      <Text
        style={{
          color: colors.muted,
          fontSize: 10.5,
          fontWeight: "700",
          letterSpacing: 0.7,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {children}
      </View>
    </View>
  );
}

export function RecipeFiltersSheet({
  visible,
  onClose,
  filters,
  categories,
  types,
  selectedPurchases,
  onApply,
  onChoosePurchases,
}: {
  visible: boolean;
  onClose: () => void;
  filters: RecetaFiltros;
  categories: RecetaCategoria[];
  types: RecetaTipo[];
  selectedPurchases: number;
  onApply: (filters: RecetaFiltros) => void;
  onChoosePurchases: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<RecetaFiltros>(filters);

  const patch = (values: Partial<RecetaFiltros>) =>
    setDraft((current) => ({ ...current, ...values }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("recipes.filters")}
      footer={
        <Button
          label={t("recipes.applyFilters")}
          icon="check"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      }
    >
      <NativeContent>
        <View style={{ paddingBottom: 8 }}>
          <Group title={t("recipes.category")}>
            <Chip
              label={t("recipes.allCategories")}
              active={draft.categoria === ""}
              onPress={() => patch({ categoria: "" })}
            />
            {categories.map((category) => (
              <Chip
                key={category.slug}
                label={category.nombre}
                active={draft.categoria === category.slug}
                onPress={() => patch({ categoria: category.slug })}
              />
            ))}
          </Group>

          <Group title={t("recipes.type")}>
            <Chip
              label={t("recipes.allTypes")}
              active={draft.tipo === ""}
              onPress={() => patch({ tipo: "" })}
            />
            {types.map((type) => (
              <Chip
                key={type.slug}
                label={type.nombre}
                active={draft.tipo === type.slug}
                onPress={() => patch({ tipo: type.slug })}
              />
            ))}
          </Group>

          <Group title={t("recipes.time")}>
            <Chip
              label={t("recipes.anyTime")}
              active={draft.tiempo === null}
              onPress={() => patch({ tiempo: null })}
            />
            {TIMES.map((time) => (
              <Chip
                key={time}
                label={t("recipes.minutesShort", { count: time })}
                active={draft.tiempo === time}
                onPress={() => patch({ tiempo: time })}
              />
            ))}
          </Group>

          <Group title={t("recipes.extras")}>
            <Chip
              label={t("recipes.favorites")}
              active={draft.favoritas}
              onPress={() => patch({ favoritas: !draft.favoritas })}
            />
            <Chip
              label={t("recipes.pantryOnly")}
              active={draft.soloDespensa}
              onPress={() => patch({ soloDespensa: !draft.soloDespensa })}
            />
          </Group>

          {draft.soloDespensa ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: colors.muted,
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                {selectedPurchases > 0
                  ? t("recipes.purchasesSelected", {
                      count: selectedPurchases,
                    })
                  : t("recipes.purchasesLatest")}
              </Text>
              <Pressable onPress={onChoosePurchases}>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {t("recipes.choosePurchases")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Pressable
              onPress={() =>
                setDraft({
                  ...EMPTY_RECIPE_FILTERS,
                  q: draft.q,
                })
              }
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {t("recipes.clearFilters")}
              </Text>
            </Pressable>
          </View>
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
