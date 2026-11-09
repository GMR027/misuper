/** Recipe cards: a 2:1-ish photo on top of the web's paper texture. */

import { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DotPattern, useTheme } from "@/components/theme";
import { t } from "@/lib/i18n";
import {
  difficultyLabel,
  recipeImage,
  recipeInitial,
  type RecetaResumen,
} from "@/lib/recipes";

function Stars({
  active,
  onPress,
  size = 18,
}: {
  active: boolean;
  onPress: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        active ? t("recipes.removeFavorite") : t("recipes.addFavorite")
      }
      style={{
        width: size + 12,
        height: size + 12,
        borderRadius: (size + 12) / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.34)",
      }}
    >
      <Text
        style={{
          color: active ? colors.warning : "#ffffff",
          fontSize: size,
          lineHeight: size + 2,
        }}
      >
        {active ? "★" : "☆"}
      </Text>
    </Pressable>
  );
}

function RecipeImage({
  recipe,
  height,
  width,
  radius = 0,
}: {
  recipe: RecetaResumen;
  height: number;
  width?: number;
  radius?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = recipeImage(recipe);

  return (
    <View
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: colors.accentContainer,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={recipe.nombre}
        />
      ) : (
        <Text
          style={{
            color: colors.accent,
            fontSize: height * 0.38,
            fontWeight: "800",
          }}
        >
          {recipeInitial(recipe)}
        </Text>
      )}
    </View>
  );
}

function SelectButton({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        active ? t("recipes.selected") : t("recipes.select")
      }
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.accent : "rgba(0,0,0,0.38)",
        borderWidth: 1,
        borderColor: active ? colors.accent : "rgba(255,255,255,0.7)",
      }}
    >
      <Text
        style={{
          color: active ? colors.onAccent : "#ffffff",
          fontSize: 15,
          fontWeight: "900",
          lineHeight: 17,
        }}
      >
        {active ? "✓" : "+"}
      </Text>
    </Pressable>
  );
}

export function RecipeCard({
  recipe,
  kcal,
  onPress,
  onToggleFavorite,
  selected = false,
  onToggleSelect,
  list = false,
  columns = 2,
  style,
}: {
  recipe: RecetaResumen;
  kcal?: number | null;
  onPress: () => void;
  onToggleFavorite: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  list?: boolean;
  /** Cards per row in grid mode (2 on phones, up to 5 on tablets). */
  columns?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, scheme } = useTheme();
  const pantry =
    recipe.total_ingredientes > 0
      ? `${recipe.tiene_count}/${recipe.total_ingredientes}`
      : null;
  const complete =
    recipe.total_ingredientes > 0 &&
    recipe.tiene_count >= recipe.total_ingredientes;

  const card: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOpacity: scheme === "dark" ? 0.28 : 0.07,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    style,
  ];

  if (list) {
    return (
      <Pressable onPress={onPress} style={[card, { marginBottom: 8 }]}>
        <DotPattern opacity={scheme === "dark" ? 0.06 : 0.03} />
        <View style={{ flexDirection: "row", padding: 10, gap: 10 }}>
          <RecipeImage recipe={recipe} height={90} width={90} radius={10} />
          <View style={{ flex: 1, gap: 3, paddingVertical: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text
                numberOfLines={2}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: "700",
                  lineHeight: 18,
                }}
              >
                {recipe.nombre}
              </Text>
              {onToggleSelect ? (
                <SelectButton
                  active={selected}
                  onPress={onToggleSelect}
                />
              ) : null}
              <Stars
                active={recipe.favorita}
                onPress={onToggleFavorite}
                size={17}
              />
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {`${t("recipes.minutes", { count: recipe.tiempo_min })} · ${t(
                difficultyLabel(recipe.dificultad),
              )}`}
            </Text>
            {kcal != null ? (
              <Text style={{ color: colors.accent, fontSize: 12 }}>
                {`≈ ${Math.round(kcal)} kcal`}
              </Text>
            ) : null}
            {pantry ? (
              <Text
                style={{
                  color: complete ? colors.success : colors.muted,
                  fontSize: 12,
                }}
              >
                {`${pantry} ${t("recipes.ingredientsHave")}`}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        card,
        {
          width: `${(100 - (columns - 1) * 1.5) / columns}%`,
          marginBottom: 8,
        },
      ]}
    >
      <DotPattern opacity={scheme === "dark" ? 0.06 : 0.03} />
      <View>
        <RecipeImage recipe={recipe} height={108} />
        <LinearGradient
          pointerEvents="none"
          colors={
            scheme === "dark"
              ? ["rgba(255,255,255,0.05)", "transparent"]
              : ["rgba(255,255,255,0.45)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 54,
          }}
        />
        {onToggleSelect ? (
          <View style={{ position: "absolute", top: 8, left: 8 }}>
            <SelectButton active={selected} onPress={onToggleSelect} />
          </View>
        ) : null}
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            flexDirection: "row",
            gap: 4,
          }}
        >
          <Stars active={recipe.favorita} onPress={onToggleFavorite} />
        </View>
        {kcal != null ? (
          <View
            style={{
              position: "absolute",
              left: 8,
              bottom: 8,
              borderRadius: 7,
              paddingHorizontal: 7,
              paddingVertical: 3,
              backgroundColor: "rgba(0,0,0,0.62)",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 10.5, fontWeight: "700" }}>
              {`≈ ${Math.round(kcal)} kcal`}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Text
          numberOfLines={2}
          style={{
            color: colors.foreground,
            fontSize: 13.5,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          {recipe.nombre}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5 }}>
          {`${t("recipes.minutes", { count: recipe.tiempo_min })} · ${t(
            difficultyLabel(recipe.dificultad),
          )}`}
        </Text>
        {pantry ? (
          <Text
            numberOfLines={1}
            style={{
              color: complete ? colors.success : colors.muted,
              fontSize: 11.5,
            }}
          >
            {`${pantry} ${t("recipes.ingredientsHave")}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
