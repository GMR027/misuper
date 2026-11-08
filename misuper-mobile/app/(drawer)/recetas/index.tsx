import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListScreen } from "@/components/list-screen";
import { MultiRecipeListSheet } from "@/components/multi-recipe-list-sheet";
import { PurchasePickerSheet } from "@/components/purchase-picker-sheet";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeFiltersSheet } from "@/components/recipe-filters-sheet";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { DOCK_HEIGHT } from "@/lib/layout";
import { t, useLocale } from "@/lib/i18n";
import {
  EMPTY_RECIPE_FILTERS,
  readSelectedPurchases,
  recipeQuery,
  saveSelectedPurchases,
  type RecetaCategoria,
  type RecetaFiltros,
  type RecetaTipo,
  type RecetasResponse,
  type RecetaResumen,
} from "@/lib/recipes";
import { showToast } from "@/lib/toast";

interface NutritionResponse {
  items: Record<string, { porcion: number }>;
}

export default function RecipesScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<RecetaFiltros>(() => ({
    ...EMPTY_RECIPE_FILTERS,
    compras: readSelectedPurchases(),
  }));
  const [items, setItems] = useState<RecetaResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [tipos, setTipos] = useState<RecetaTipo[]>([]);
  const [categorias, setCategorias] = useState<RecetaCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kcal, setKcal] = useState<Record<string, number>>({});
  const [grid, setGrid] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const [selection, setSelection] = useState<
    Map<string, { slug: string; nombre: string; porcionesBase: number }>
  >(() => new Map());
  const [multiOpen, setMultiOpen] = useState(false);
  const nutritionSeen = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);

        void apiFetch<RecetasResponse>(`/api/recetas${recipeQuery(filters)}`)
          .then((data) => {
            if (!alive) return;
            setItems(Array.isArray(data.items) ? data.items : []);
            setTotal(data.total);
            setTipos(Array.isArray(data.tipos) ? data.tipos : []);
            setCategorias(Array.isArray(data.categorias) ? data.categorias : []);
          })
          .catch((caught) => {
            if (alive) {
              setItems([]);
              setError(apiErrorMessage(caught));
            }
          })
          .finally(() => {
            if (alive) setLoading(false);
          });
      },
      filters.q.trim() === "" ? 0 : 320,
    );

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters]);

  useEffect(() => {
    const slugs = items
      .slice(0, 60)
      .map((recipe) => recipe.slug)
      .filter((slug) => nutritionSeen.current[slug] !== true);

    if (slugs.length === 0) return;

    for (const slug of slugs) nutritionSeen.current[slug] = true;

    let alive = true;

    void (async () => {
      for (let index = 0; index < slugs.length; index += 30) {
        const batch = slugs.slice(index, index + 30);

        try {
          const data = await apiFetch<NutritionResponse>(
            `/api/recetas/nutricion?slugs=${encodeURIComponent(batch.join(","))}`,
          );

          if (!alive) return;

          const next: Record<string, number> = {};
          for (const [slug, info] of Object.entries(data.items ?? {})) {
            if (typeof info?.porcion === "number") next[slug] = info.porcion;
          }
          setKcal((current) => ({ ...current, ...next }));
        } catch {
          // Nutrition is optional; the card simply keeps its placeholder.
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [items]);

  const patch = (values: Partial<RecetaFiltros>) =>
    setFilters((current) => ({ ...current, ...values }));

  const activeCount =
    (filters.categoria !== "" ? 1 : 0) +
    (filters.tipo !== "" ? 1 : 0) +
    (filters.tiempo !== null ? 1 : 0) +
    (filters.favoritas ? 1 : 0) +
    (filters.soloDespensa ? 1 : 0);

  const activeLabels: string[] = [];

  if (filters.categoria !== "") {
    const category = categorias.find((item) => item.slug === filters.categoria);
    if (category) activeLabels.push(category.nombre);
  }
  if (filters.tipo !== "") {
    const type = tipos.find((item) => item.slug === filters.tipo);
    if (type) activeLabels.push(type.nombre);
  }
  if (filters.tiempo !== null) {
    activeLabels.push(t("recipes.minutesShort", { count: filters.tiempo }));
  }
  if (filters.favoritas) activeLabels.push(t("recipes.favorites"));
  if (filters.soloDespensa) {
    activeLabels.push(
      filters.compras.length > 0
        ? filters.compras.length === 1
          ? t("recipes.purchasesCountOne")
          : t("recipes.purchasesCount", { count: filters.compras.length })
        : t("recipes.pantryOnly"),
    );
  }

  const toggleFavorite = async (recipe: RecetaResumen) => {
    try {
      const data = await apiFetch<{ favorita: boolean }>(
        `/api/recetas/${recipe.slug}/favorito`,
        { method: "POST" },
      );

      setItems((current) => {
        if (filters.favoritas && !data.favorita) {
          return current.filter((item) => item.slug !== recipe.slug);
        }

        return current.map((item) =>
          item.slug === recipe.slug
            ? { ...item, favorita: data.favorita }
            : item,
        );
      });

      if (filters.favoritas && !data.favorita) {
        setTotal((current) => Math.max(0, current - 1));
      }
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    }
  };

  const toggleSelect = (recipe: RecetaResumen) => {
    setSelection((current) => {
      const next = new Map(current);
      if (next.has(recipe.slug)) {
        next.delete(recipe.slug);
      } else {
        next.set(recipe.slug, {
          slug: recipe.slug,
          nombre: recipe.nombre,
          porcionesBase: recipe.porciones_base,
        });
      }
      return next;
    });
  };

  const header = (
    <View style={{ gap: 10, paddingBottom: 4 }}>
      <TextField
        value={filters.q}
        onChangeText={(value) => patch({ q: value })}
        label={t("recipes.search")}
        placeholder={t("recipes.searchPlaceholder")}
        leadingIcon="search"
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            height: 34,
            paddingHorizontal: 12,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: activeCount > 0 ? colors.accent : colors.border,
            backgroundColor:
              activeCount > 0 ? colors.accentContainer : "transparent",
          }}
        >
          <Text
            style={{
              color:
                activeCount > 0 ? colors.onAccentContainer : colors.foreground,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {t("recipes.filters")}
            {activeCount > 0 ? ` (${activeCount})` : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => patch({ favoritas: !filters.favoritas })}
          style={{
            height: 34,
            paddingHorizontal: 12,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: filters.favoritas ? colors.accent : colors.border,
            backgroundColor: filters.favoritas
              ? colors.accentContainer
              : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: filters.favoritas
                ? colors.onAccentContainer
                : colors.foreground,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            ★
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => setGrid((value) => !value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            grid ? t("recipes.listView") : t("recipes.gridView")
          }
          style={{
            width: 36,
            height: 34,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 17,
              lineHeight: 19,
            }}
          >
            {grid ? "☰" : "▦"}
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 2,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {t("recipes.results", { count: total })}
        </Text>
        {activeLabels.length > 0 ? (
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: colors.accent, fontSize: 11 }}
          >
            {activeLabels.join(" · ")}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {activeCount > 0 ? (
          <Pressable
            onPress={() =>
              setFilters((current) => ({
                ...current,
                categoria: "",
                tipo: "",
                tiempo: null,
                favoritas: false,
                soloDespensa: false,
              }))
            }
          >
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {t("recipes.clear")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable onPress={() => router.push("/recetas/proponer")}>
          <Text
            style={{
              color: colors.accent,
              fontSize: 11.5,
              fontWeight: "700",
            }}
          >
            {t("recipes.propose")}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          <Spinner />
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );

  return (
    <>
      <ListScreen
        title={t("recipes.title")}
        data={items}
        extraData={{ grid, kcal, filters }}
        keyExtractor={(item) => item.slug}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            kcal={kcal[item.slug]}
            list={!grid}
            onPress={() => router.push(`/recetas/${item.slug}`)}
            onToggleFavorite={() => void toggleFavorite(item)}
            selected={selection.has(item.slug)}
            onToggleSelect={() => toggleSelect(item)}
          />
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <TextureCard>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  textAlign: "center",
                  paddingVertical: 16,
                }}
              >
                {t("recipes.empty")}
              </Text>
            </TextureCard>
          ) : null
        }
        ListFooterComponent={
          items.length > 0 ? (
            <Text
              style={{
                color: colors.muted,
                fontSize: 10.5,
                textAlign: "center",
                paddingTop: 10,
              }}
            >
              {t("recipes.footer", { count: items.length })}
            </Text>
          ) : null
        }
      />

      {filtersOpen ? (
        <RecipeFiltersSheet
          visible
          filters={filters}
          categories={categorias}
          types={tipos}
          selectedPurchases={filters.compras.length}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next);
            saveSelectedPurchases(next.compras);
          }}
          onChoosePurchases={() => {
            setPickerKey((value) => value + 1);
            setPurchasesOpen(true);
          }}
        />
      ) : null}

      {purchasesOpen ? (
        <PurchasePickerSheet
          key={`purchases-${pickerKey}`}
          visible
          selected={filters.compras}
          onClose={() => setPurchasesOpen(false)}
          onApply={(ids) => {
            saveSelectedPurchases(ids);
            patch({ compras: ids, soloDespensa: true });
          }}
        />
      ) : null}

      {selection.size > 0 ? (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + DOCK_HEIGHT + 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.accent,
            shadowColor: "#000000",
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          }}
        >
          <Text style={{ flex: 1, color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
            {t("recipes.selectedCount", { count: selection.size })}
          </Text>
          <Pressable onPress={() => setSelection(new Map())}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
              {t("recipes.clearSelection")}
            </Text>
          </Pressable>
          <Button
            label={t("recipes.createList")}
            icon="shopping-cart"
            onPress={() => setMultiOpen(true)}
          />
        </View>
      ) : null}

      {multiOpen ? (
        <MultiRecipeListSheet
          visible
          onClose={() => {
            setMultiOpen(false);
            setSelection(new Map());
          }}
          selections={Array.from(selection.values())}
        />
      ) : null}
    </>
  );
}
