import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { UnitPicker } from "@/components/unit-picker";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch, apiUpload } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import {
  type RecetaCategoria,
  type RecetasResponse,
  type RecetaTipo,
} from "@/lib/recipes";
import { showToast } from "@/lib/toast";

interface DraftIngredient {
  key: string;
  nombre: string;
  cantidad: string;
  unidad: string;
}

const DIFFICULTIES = ["facil", "media", "dificil"] as const;

function chipStyle(active: boolean, colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.border,
    backgroundColor: active ? colors.accent : "transparent",
  } as const;
}

export default function ProposeRecipeScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const [categories, setCategories] = useState<RecetaCategoria[]>([]);
  const [types, setTypes] = useState<RecetaTipo[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["general"]);
  const [portions, setPortions] = useState("4");
  const [time, setTime] = useState("30");
  const [difficulty, setDifficulty] = useState<string>("facil");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([
    { key: "i1", nombre: "", cantidad: "1", unidad: "pza" },
  ]);
  const [steps, setSteps] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<RecetasResponse>("/api/recetas?q=__none__");
        if (!alive) return;
        setCategories(data.categorias ?? []);
        setTypes(data.tipos ?? []);
        if (data.categorias?.length) setCategory(data.categorias[0].slug);
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoadingMeta(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const addIngredient = () => {
    setIngredients((current) => [
      ...current,
      {
        key: `i${Date.now()}`,
        nombre: "",
        cantidad: "1",
        unidad: "pza",
      },
    ]);
  };

  const updateIngredient = (key: string, patch: Partial<DraftIngredient>) => {
    setIngredients((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
    setError(null);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t("notes.permission"), "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append(
        "imagen",
        {
          uri: result.assets[0].uri,
          name: result.assets[0].fileName ?? "receta.jpg",
          type: result.assets[0].mimeType ?? "image/jpeg",
        } as unknown as Blob,
      );
      const data = await apiUpload<{ imagen_url: string }>(
        "/api/recetas/imagen",
        form,
      );
      setImage(data.imagen_url);
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (saving) return;

    if (name.trim().length < 2 || name.trim().length > 150) {
      setError(t("recipes.nameInvalid"));
      return;
    }

    if (category === "" || selectedTypes.length === 0) {
      setError(t("recipes.categoryTypeRequired"));
      return;
    }

    const normalizedIngredients = ingredients
      .map((item) => ({
        nombre: item.nombre.trim(),
        cantidad: item.cantidad,
        unidad: item.unidad,
      }))
      .filter((item) => item.nombre !== "");

    if (normalizedIngredients.length === 0) {
      setError(t("recipes.ingredientRequired"));
      return;
    }

    for (const item of normalizedIngredients) {
      if (
        item.unidad !== "al_gusto" &&
        (!Number.isFinite(Number(item.cantidad)) || Number(item.cantidad) <= 0)
      ) {
        setError(t("recipes.ingredientQuantityInvalid"));
        return;
      }
    }

    const normalizedSteps = steps
      .split(/\R/)
      .map((step) => step.trim())
      .filter((step) => step !== "");

    if (normalizedSteps.length === 0) {
      setError(t("recipes.stepsRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch<{ id: number }>("/api/recetas/proponer", {
        method: "POST",
        body: {
          nombre: name.trim(),
          descripcion: description.trim(),
          categoria: category,
          tipos: selectedTypes,
          porciones_base: Number(portions) || 4,
          tiempo_min: Number(time) || 30,
          dificultad: difficulty,
          ingredientes: normalizedIngredients.map((item) => ({
            nombre: item.nombre,
            producto: item.nombre,
            cantidad:
              item.unidad === "al_gusto" ? null : Number(item.cantidad),
            unidad: item.unidad,
            principal: false,
            basico: false,
          })),
          pasos: normalizedSteps,
          imagen_url: image ?? undefined,
        },
      });

      showToast(t("recipes.proposeSent"), "success");
      router.back();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (slug: string) => {
    setSelectedTypes((current) =>
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug],
    );
  };

  return (
    <Screen title={t("recipes.proposeTitle")}>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
        {t("recipes.proposeHint")}
      </Text>

      {loadingMeta ? (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <Spinner />
        </View>
      ) : null}

      <TextureCard>
        <TextField
          value={name}
          onChangeText={setName}
          label={t("recipes.name")}
          placeholder={t("recipes.namePlaceholder")}
        />
        <TextField
          value={description}
          onChangeText={setDescription}
          label={t("recipes.description")}
          placeholder={t("recipes.descriptionPlaceholder")}
          multiline
          minLines={2}
          maxLines={4}
        />

        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
          {t("recipes.category")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {categories.map((item) => (
            <Pressable
              key={item.slug}
              onPress={() => setCategory(item.slug)}
              style={chipStyle(category === item.slug, colors)}
            >
              <Text
                style={{
                  color:
                    category === item.slug
                      ? colors.onAccent
                      : colors.foreground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {item.nombre}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
          {t("recipes.type")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {types.map((item) => {
            const active = selectedTypes.includes(item.slug);
            return (
              <Pressable
                key={item.slug}
                onPress={() => toggleType(item.slug)}
                style={chipStyle(active, colors)}
              >
                <Text
                  style={{
                    color: active ? colors.onAccent : colors.foreground,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {item.nombre}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={portions}
              onChangeText={setPortions}
              label={t("recipes.portions")}
              keyboardType="number"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              value={time}
              onChangeText={setTime}
              label={t("recipes.timeMinutes")}
              keyboardType="number"
            />
          </View>
        </View>

        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
          {t("recipes.difficultyTitle")}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {DIFFICULTIES.map((value) => (
            <Pressable
              key={value}
              onPress={() => setDifficulty(value)}
              style={chipStyle(difficulty === value, colors)}
            >
              <Text
                style={{
                  color: difficulty === value ? colors.onAccent : colors.foreground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {t(`recipes.difficulty.${value === "facil" ? "easy" : value === "media" ? "medium" : "hard"}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </TextureCard>

      <TextureCard>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
          {t("recipes.image")}
        </Text>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: 160, borderRadius: 10 }}
            resizeMode="cover"
          />
        ) : null}
        <Button
          label={
            uploading
              ? t("recipes.uploading")
              : image
                ? t("recipes.changeImage")
                : t("recipes.chooseImage")
          }
          variant="outlined"
          icon="upload-file"
          onPress={() => void pickImage()}
          disabled={uploading}
        />
      </TextureCard>

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 2 }}>
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, fontWeight: "800" }}>
          {t("recipes.ingredientsTitle", { count: ingredients.length })}
        </Text>
        <Pressable onPress={addIngredient}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>
            {t("recipes.addIngredient")}
          </Text>
        </Pressable>
      </View>

      {ingredients.map((item) => (
        <TextureCard key={item.key}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ flex: 1 }}>
              <TextField
                value={item.nombre}
                onChangeText={(value) =>
                  updateIngredient(item.key, { nombre: value })
                }
                label={t("recipes.ingredientName")}
                placeholder={t("recipes.ingredientPlaceholder")}
              />
            </View>
            <IconButton
              icon="delete"
              label={t("recipes.removeIngredient")}
              onPress={() =>
                setIngredients((current) =>
                  current.length <= 1
                    ? current
                    : current.filter((row) => row.key !== item.key),
                )
              }
              size={30}
              iconSize={17}
              color={colors.error}
            />
          </View>
          {item.unidad === "al_gusto" ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {t("recipes.toTaste")}
            </Text>
          ) : (
            <TextField
              value={item.cantidad}
              onChangeText={(value) =>
                updateIngredient(item.key, { cantidad: value })
              }
              label={t("recipes.quantity")}
              keyboardType="decimal"
            />
          )}
          <UnitPicker
            value={item.unidad}
            includeTaste
            onChange={(unit) => updateIngredient(item.key, { unidad: unit })}
          />
        </TextureCard>
      ))}

      <TextureCard>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
          {t("recipes.stepsTitle")}
        </Text>
        <TextField
          value={steps}
          onChangeText={setSteps}
          label={t("recipes.stepsLabel")}
          placeholder={t("recipes.stepsPlaceholder")}
          multiline
          minLines={5}
          maxLines={12}
        />
      </TextureCard>

      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}

      <Button
        label={saving ? t("recipes.submitting") : t("recipes.submit")}
        icon="check"
        onPress={() => void submit()}
        disabled={saving || uploading || loadingMeta}
      />
    </Screen>
  );
}
