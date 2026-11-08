import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AddRecipeListSheet } from "@/components/add-recipe-list-sheet";
import { AddRecipeMenuSheet } from "@/components/add-recipe-menu-sheet";
import { PurchasePickerSheet } from "@/components/purchase-picker-sheet";
import { RecipeVideoModal } from "@/components/recipe-video-modal";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import {
  difficultyLabel,
  ingredientUnit,
  readSelectedPurchases,
  recipeImage,
  recipeInitial,
  saveSelectedPurchases,
  type RecetaDetalle,
} from "@/lib/recipes";
import { showToast } from "@/lib/toast";

function unitText(unit: string): string {
  const value = ingredientUnit(unit);
  return value.startsWith("recipes.") ? t(value) : value;
}

export default function RecipeDetailScreen() {
  useLocale();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { colors } = useTheme();
  const [recipe, setRecipe] = useState<RecetaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portions, setPortions] = useState(1);
  const [compras, setCompras] = useState<number[]>(() => readSelectedPurchases());
  const [videoOpen, setVideoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const query =
      compras.length > 0 ? `?compras=${compras.join(",")}` : "";

    void (async () => {
      try {
        const data = await apiFetch<RecetaDetalle>(
          `/api/recetas/${slug}${query}`,
        );

        if (!alive) return;

        setRecipe(data);
        setPortions((current) =>
          current <= 1 ? data.porciones_base : current,
        );
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug, compras]);

  if (loading) {
    return (
      <Screen title={t("recipes.detailTitle")}>
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  if (error || recipe === null) {
    return (
      <Screen title={t("recipes.detailTitle")}>
        <TextureCard>
          <Text style={{ color: colors.error, fontSize: 13 }}>
            {error ?? t("recipes.notFound")}
          </Text>
        </TextureCard>
      </Screen>
    );
  }

  const factor = portions / Math.max(1, recipe.porciones_base);
  const image = recipeImage(recipe);
  const totalCost = recipe.costo.total * factor;
  const perPortionCost = recipe.costo.porcion;
  const totalKcal = recipe.nutricion.total * factor;
  const perPortionKcal = portions > 0 ? totalKcal / portions : 0;
  const missing = recipe.faltan ?? [];
  const missingSet = new Set(missing.map((name) => name.toLocaleLowerCase()));

  const changePortions = (delta: number) =>
    setPortions((current) =>
      Math.max(1, Math.min(50, Math.round(current + delta))),
    );

  const toggleFavorite = async () => {
    try {
      const data = await apiFetch<{ favorita: boolean }>(
        `/api/recetas/${recipe.slug}/favorito`,
        { method: "POST" },
      );
      setRecipe((current) =>
        current ? { ...current, favorita: data.favorita } : current,
      );
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    }
  };

  const openExternal = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  const footer = (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 6,
      }}
    >
      <View style={{ flex: 1 }}>
        <Button
          label={t("recipes.addToMenu")}
          variant="outlined"
          icon="receipt-long"
          onPress={() => setMenuOpen(true)}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Button
          label={t("recipes.addToList")}
          icon="shopping-cart"
          onPress={() => setListOpen(true)}
        />
      </View>
    </View>
  );

  return (
    <>
      <Screen title={t("recipes.detailTitle")} footer={footer}>
        <View style={{ borderRadius: 18, overflow: "hidden" }}>
          <View
            style={{
              height: 220,
              backgroundColor: colors.accentContainer,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 76,
                  fontWeight: "800",
                }}
              >
                {recipeInitial(recipe)}
              </Text>
            )}
          </View>
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(0,0,0,0.42)"]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 90,
            }}
          />
          <Pressable
            onPress={() => void toggleFavorite()}
            accessibilityRole="button"
            accessibilityState={{ selected: recipe.favorita }}
            accessibilityLabel={
              recipe.favorita
                ? t("recipes.removeFavorite")
                : t("recipes.addFavorite")
            }
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(0,0,0,0.4)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: recipe.favorita ? colors.warning : "#ffffff",
                fontSize: 23,
                lineHeight: 25,
              }}
            >
              {recipe.favorita ? "★" : "☆"}
            </Text>
          </Pressable>
          {recipe.video ? (
            <Pressable
              onPress={() => setVideoOpen(true)}
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 9,
                backgroundColor: "rgba(0,0,0,0.62)",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "800" }}>
                ▶
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                {t("recipes.watchVideo")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ gap: 6, paddingHorizontal: 2 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 23,
              fontWeight: "800",
              lineHeight: 28,
            }}
          >
            {recipe.nombre}
          </Text>
          {recipe.descripcion.trim() !== "" ? (
            <Text
              style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18 }}
            >
              {recipe.descripcion}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            {[
              t("recipes.minutes", { count: recipe.tiempo_min }),
              t("recipes.portionsCount", { count: recipe.porciones_base }),
              t(difficultyLabel(recipe.dificultad)),
              recipe.categoria?.nombre ?? t("recipes.uncategorized"),
            ].join(" · ")}
          </Text>
          {recipe.tipos_detalle.length > 0 ? (
            <Text style={{ color: colors.accent, fontSize: 10.5 }}>
              {recipe.tipos_detalle.map((type) => type.nombre).join(" · ")}
            </Text>
          ) : null}
        </View>

        <TextureCard>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {t("recipes.pantryTitle")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                {recipe.total_ingredientes > 0
                  ? t("recipes.pantrySummary", {
                      have: recipe.tiene_count,
                      total: recipe.total_ingredientes,
                    })
                  : t("recipes.pantryEmpty")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                {compras.length > 0
                  ? compras.length === 1
                    ? t("recipes.purchasesSelectedOne")
                    : t("recipes.purchasesSelected", { count: compras.length })
                  : t("recipes.purchasesLatest")}
              </Text>
            </View>
            <Button
              label={t("recipes.choosePurchases")}
              variant="outlined"
              onPress={() => {
                setPickerKey((value) => value + 1);
                setPurchasesOpen(true);
              }}
            />
          </View>
          {missing.length > 0 ? (
            <Text
              numberOfLines={3}
              style={{ color: colors.warning, fontSize: 11, lineHeight: 16 }}
            >
              {t("recipes.missingIngredients", {
                items: missing.slice(0, 8).join(", "),
              })}
            </Text>
          ) : recipe.total_ingredientes > 0 ? (
            <Text style={{ color: colors.success, fontSize: 11 }}>
              {t("recipes.allIngredients")}
            </Text>
          ) : null}
        </TextureCard>

        <TextureCard>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {t("recipes.portions")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                {t("recipes.portionsBase", {
                  count: recipe.porciones_base,
                })}
              </Text>
            </View>
            <Pressable
              onPress={() => changePortions(-1)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 20,
                  fontWeight: "700",
                  lineHeight: 22,
                }}
              >
                −
              </Text>
            </Pressable>
            <Text
              style={{
                minWidth: 34,
                textAlign: "center",
                color: colors.foreground,
                fontSize: 19,
                fontWeight: "800",
              }}
            >
              {portions}
            </Text>
            <Pressable
              onPress={() => changePortions(1)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.onAccent,
                  fontSize: 20,
                  fontWeight: "700",
                  lineHeight: 22,
                }}
              >
                +
              </Text>
            </Pressable>
          </View>
        </TextureCard>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "800",
              paddingHorizontal: 2,
            }}
          >
            {t("recipes.ingredientsTitle", {
              count: recipe.ingredientes.length,
            })}
          </Text>
          <TextureCard>
            <View style={{ gap: 0 }}>
              {recipe.ingredientes.map((ingredient, index) => {
                const amount =
                  ingredient.cantidad === null
                    ? unitText(ingredient.unidad)
                    : `${formatQuantity(ingredient.cantidad * factor)} ${unitText(
                        ingredient.unidad,
                      )}`;
                const isMissing = missingSet.has(
                  ingredient.nombre.toLocaleLowerCase(),
                );

                return (
                  <View
                    key={`ingredient-${index}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                      paddingVertical: 7,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        width: 68,
                        color: colors.accent,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {amount}
                    </Text>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        style={{
                          color: isMissing ? colors.muted : colors.foreground,
                          fontSize: 12.5,
                          fontWeight: ingredient.principal ? "700" : "500",
                        }}
                      >
                        {ingredient.nombre}
                      </Text>
                      {ingredient.principal || ingredient.basico ? (
                        <Text style={{ color: colors.muted, fontSize: 9.5 }}>
                          {[
                            ingredient.principal
                              ? t("recipes.mainIngredient")
                              : null,
                            ingredient.basico ? t("recipes.basicIngredient") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                    {isMissing ? (
                      <Text
                        style={{
                          color: colors.warning,
                          fontSize: 9.5,
                          fontWeight: "700",
                        }}
                      >
                        {t("recipes.missing")}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </TextureCard>
        </View>

        {recipe.pasos.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 16,
                fontWeight: "800",
                paddingHorizontal: 2,
              }}
            >
              {t("recipes.stepsTitle")}
            </Text>
            <TextureCard>
              <View style={{ gap: 10 }}>
                {recipe.pasos.map((step, index) => (
                  <View
                    key={`step-${index}`}
                    style={{ flexDirection: "row", gap: 10 }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: colors.accentContainer,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.onAccentContainer,
                          fontSize: 11,
                          fontWeight: "800",
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        color: colors.foreground,
                        fontSize: 12.5,
                        lineHeight: 18,
                      }}
                    >
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
            </TextureCard>
          </View>
        ) : null}

        <TextureCard>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {t("recipes.costTitle")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                {t("recipes.costTotal", { count: portions })}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                {formatCurrency(totalCost)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                {t("recipes.costPortion")}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                {formatCurrency(perPortionCost)}
              </Text>
            </View>
          </View>
          {!recipe.costo.completo ? (
            <Text style={{ color: colors.warning, fontSize: 10.5, lineHeight: 15 }}>
              {t("recipes.costPartial", {
                count: recipe.costo.items_sin_precio ?? 0,
              })}
            </Text>
          ) : null}
          {(recipe.costo.precios_viejos ?? 0) > 0 ? (
            <Text style={{ color: colors.warning, fontSize: 10.5 }}>
              {t("recipes.costOld", {
                count: recipe.costo.precios_viejos ?? 0,
              })}
            </Text>
          ) : null}
        </TextureCard>

        <TextureCard>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {t("recipes.nutritionTitle")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                {t("recipes.costTotal", { count: portions })}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                {`${Math.round(totalKcal)} kcal`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                {t("recipes.costPortion")}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                {`${Math.round(perPortionKcal)} kcal`}
              </Text>
            </View>
          </View>
          {!recipe.nutricion.completo ? (
            <Text style={{ color: colors.warning, fontSize: 10.5, lineHeight: 15 }}>
              {t("recipes.nutritionPartial", {
                count: recipe.nutricion.sin_dato,
              })}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 9.5 }}>
            {t("recipes.nutritionNote")}
          </Text>
        </TextureCard>

        {recipe.referencia || recipe.fuente_nombre ? (
          <TextureCard>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {t("recipes.referenceTitle")}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {recipe.fuente_nombre ?? t("recipes.referenceFallback")}
              {recipe.fuente_autor ? ` · ${recipe.fuente_autor}` : ""}
            </Text>
            {recipe.fuente_url ? (
              <Pressable
                onPress={() => openExternal(recipe.fuente_url as string)}
              >
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 11.5,
                    fontWeight: "600",
                  }}
                >
                  {t("recipes.openSource")}
                </Text>
              </Pressable>
            ) : null}
          </TextureCard>
        ) : null}
      </Screen>

      {menuOpen ? (
        <AddRecipeMenuSheet
          visible
          onClose={() => setMenuOpen(false)}
          recipeId={recipe.id}
          recipeName={recipe.nombre}
          basePortions={portions}
        />
      ) : null}

      {listOpen ? (
        <AddRecipeListSheet
          visible
          onClose={() => setListOpen(false)}
          slug={recipe.slug}
          recipeName={recipe.nombre}
          portions={portions}
        />
      ) : null}

      {purchasesOpen ? (
        <PurchasePickerSheet
          key={`purchases-${pickerKey}`}
          visible
          selected={compras}
          onClose={() => setPurchasesOpen(false)}
          onApply={(ids) => {
            saveSelectedPurchases(ids);
            setCompras(ids);
          }}
        />
      ) : null}

      <RecipeVideoModal
        visible={videoOpen}
        video={recipe.video}
        title={recipe.nombre}
        onClose={() => setVideoOpen(false)}
        onOpenExternal={openExternal}
      />
    </>
  );
}
