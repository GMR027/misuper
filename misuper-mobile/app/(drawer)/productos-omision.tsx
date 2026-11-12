/** Ingredients the user ignores when a recipe is compared with purchases. */

import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { Card } from "@/components/m3/card";
import { Button, IconButton } from "@/components/m3/buttons";
import { ChipGrid, type ChipOption } from "@/components/m3/chips";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { ListRow } from "@/components/m3/lists";
import { M3Text } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface Omision {
  id: number;
  nombre: string;
}

const SUGGESTIONS = ["Sal", "Aceite", "Comino", "Canela", "Pimienta", "Orégano", "Agua"];

export default function OmissionsScreen() {
  useLocale();
  const { colors } = useTheme();
  const [items, setItems] = useState<Omision[]>([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<{ items: Omision[]; total: number }>(
          "/api/productos-omision",
        );

        if (alive) setItems(Array.isArray(data?.items) ? data.items : []);
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

  const add = async () => {
    const value = nombre.trim();

    if (value === "" || saving) return;

    setSaving(true);
    setError(null);

    try {
      const item = await apiFetch<Omision>("/api/productos-omision", {
        method: "POST",
        body: { nombre: value },
      });

      setItems((current) =>
        [...current, item].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      );
      setNombre("");
      showToast(t("omissions.added"), "success");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: Omision) => {
    Alert.alert(
      t("omissions.deleteTitle"),
      t("omissions.deleteBody", { name: item.nombre }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await apiFetch(`/api/productos-omision/${item.id}`, {
                  method: "DELETE",
                });

                setItems((current) =>
                  current.filter((entry) => entry.id !== item.id),
                );
                showToast(t("omissions.deleted"), "success");
              } catch (caught) {
                showToast(apiErrorMessage(caught), "error");
              }
            })();
          },
        },
      ],
    );
  };

  const suggestions: ChipOption<string | null>[] = SUGGESTIONS.map((value) => ({
    value,
    label: value,
  }));

  return (
    <Screen title={t("omissions.title")}>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        {t("omissions.intro")}
      </Text>

      <Card>
        <TextField
          value={nombre}
          onChangeText={setNombre}
          label={t("omissions.field")}
          placeholder={t("omissions.placeholder")}
        />
        <Button
          label={saving ? t("omissions.saving") : t("omissions.add")}
          icon="add"
          onPress={() => void add()}
          disabled={saving || nombre.trim() === ""}
        />
        <M3Text variant="caption" color="muted">
          {t("omissions.suggestions")}
        </M3Text>
        <ChipGrid<string | null>
          options={suggestions}
          value={null}
          onChange={(value) => {
            if (typeof value === "string") setNombre(value);
          }}
        />
      </Card>

      {error !== null ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Spinner />
        </View>
      ) : items.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 28,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.borderStrong,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
            {t("omissions.empty")}
          </Text>
        </View>
      ) : (
        <Card>
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={item.nombre}
              trailing={
                <IconButton
                  icon="delete"
                  label={t("omissions.delete")}
                  variant="standard"
                  color={colors.error}
                  onPress={() => remove(item)}
                  size={36}
                  iconSize={20}
                />
              }
            />
          ))}
        </Card>
      )}

      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
        {t("omissions.hint")}
      </Text>
    </Screen>
  );
}
