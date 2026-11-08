import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ListScreen } from "@/components/list-screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface AdminReceta {
  id: number;
  nombre: string;
  categoria: { nombre: string } | null;
  tipos_nombres: string[];
  estado: string;
  ingredientes_count: number;
  pasos_count: number;
  creador_nombre: string | null;
  referencia: boolean;
}

interface AdminRecetasResponse {
  items: AdminReceta[];
}

const STATES = ["todas", "publicada", "pendiente", "borrador"] as const;

export default function AdminRecipesScreen() {
  useLocale();
  const { colors } = useTheme();
  const [items, setItems] = useState<AdminReceta[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATES)[number]>("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<AdminRecetasResponse>("/api/admin/recetas");
      setItems(Array.isArray(data.items) ? data.items : []);
      setError(null);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<AdminRecetasResponse>("/api/admin/recetas");
        if (alive) setItems(Array.isArray(data.items) ? data.items : []);
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

  const filtered = items.filter((item) => {
    const q = query.trim().toLocaleLowerCase();
    const matchesQuery =
      q === "" || item.nombre.toLocaleLowerCase().includes(q);
    const matchesStatus = status === "todas" || item.estado === status;
    return matchesQuery && matchesStatus;
  });

  const publish = async (item: AdminReceta) => {
    setBusy(item.id);
    try {
      await apiFetch<unknown>(`/api/admin/recetas/${item.id}/publicar`, {
        method: "POST",
      });
      await load();
      showToast(t("admin.recipePublished"), "success");
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = (item: AdminReceta) => {
    Alert.alert(t("admin.deleteRecipeTitle"), t("admin.deleteRecipeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(item.id);
            try {
              await apiFetch<unknown>(`/api/admin/recetas/${item.id}`, {
                method: "DELETE",
              });
              await load();
              showToast(t("admin.recipeDeleted"), "success");
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            } finally {
              setBusy(null);
            }
          })();
        },
      },
    ]);
  };

  const header = (
    <View style={{ gap: 8, paddingBottom: 4 }}>
      <TextField
        value={query}
        onChangeText={setQuery}
        label={t("admin.searchRecipes")}
        placeholder={t("admin.searchRecipesPlaceholder")}
        leadingIcon="search"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {STATES.map((value) => {
          const active = status === value;
          return (
            <Pressable
              key={value}
              onPress={() => setStatus(value)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
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
                {t(`admin.state.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 10.5 }}>
        {t("admin.recipeCount", { count: filtered.length })}
      </Text>
      {loading ? <Spinner /> : null}
      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );

  return (
    <ListScreen
      title={t("admin.recipes")}
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <TextureCard style={{ marginBottom: 8 }}>
          <View style={{ gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                numberOfLines={2}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 13.5,
                  fontWeight: "700",
                }}
              >
                {item.nombre}
              </Text>
              <Text
                style={{
                  color:
                    item.estado === "publicada"
                      ? colors.success
                      : item.estado === "pendiente"
                        ? colors.warning
                        : colors.muted,
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                {t(`admin.state.${item.estado}`)}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 10.5 }}>
              {`${item.categoria?.nombre ?? t("recipes.uncategorized")} · ${t(
                "admin.ingredientsSteps",
                {
                  ingredients: item.ingredientes_count,
                  steps: item.pasos_count,
                },
              )}`}
            </Text>
            {item.tipos_nombres.length > 0 ? (
              <Text style={{ color: colors.accent, fontSize: 10 }}>
                {item.tipos_nombres.join(" · ")}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
              {item.estado !== "publicada" ? (
                <Button
                  label={
                    busy === item.id
                      ? t("common.loading")
                      : t("admin.publish")
                  }
                  icon="check"
                  onPress={() => void publish(item)}
                  disabled={busy === item.id}
                />
              ) : null}
              <Button
                label={t("admin.delete")}
                variant="outlined"
                icon="delete"
                onPress={() => void remove(item)}
                disabled={busy === item.id}
              />
            </View>
          </View>
        </TextureCard>
      )}
    />
  );
}
