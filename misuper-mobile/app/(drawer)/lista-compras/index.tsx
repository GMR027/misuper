import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheet } from "@/components/bottom-sheet";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import { useResponsive } from "@/lib/responsive";
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

export default function ShoppingListsScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const { contentWidth } = useResponsive();
  const listColumns = contentWidth >= 900 ? 3 : contentWidth >= 560 ? 2 : 1;
  const [items, setItems] = useState<ListaResumen[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiFetch<ListsResponse>("/api/listas-compra");
      setItems(Array.isArray(data.items) ? data.items : []);
      setPendientes(data.pendientes ?? 0);
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
        const data = await apiFetch<ListsResponse>("/api/listas-compra");

        if (!alive) return;

        setItems(Array.isArray(data.items) ? data.items : []);
        setPendientes(data.pendientes ?? 0);
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

  const create = async () => {
    if (saving) return;
    if (name.trim().length === 0) {
      showToast(t("shopping.nameRequired"), "error");
      return;
    }

    setSaving(true);
    try {
      const list = await apiFetch<{ id: number }>("/api/listas-compra", {
        method: "POST",
        body: { nombre: name.trim() },
      });
      setCreateOpen(false);
      setName("");
      showToast(t("shopping.created"), "success");
      await load();
      router.push(`/lista-compras/${list.id}`);
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Screen title={t("shopping.title")}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{ flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 }}
          >
            {t("shopping.subtitle")}
          </Text>
          <Button
            label={t("shopping.new")}
            icon="add"
            onPress={() => setCreateOpen(true)}
          />
        </View>

        {pendientes > 0 ? (
            <TextureCard>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
                {t("shopping.pendingSummary", { count: pendientes })}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {t("shopping.pendingHint")}
              </Text>
            </TextureCard>
        ) : null}

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 28 }}>
            <Spinner />
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}

        {!loading && items.length === 0 ? (
          <TextureCard>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                textAlign: "center",
                paddingVertical: 14,
              }}
            >
              {t("shopping.empty")}
            </Text>
          </TextureCard>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {items.map((list) => (
            <Pressable
              key={list.id}
              onPress={() => router.push(`/lista-compras/${list.id}`)}
              style={{
                width:
                  listColumns === 1
                    ? "100%"
                    : listColumns === 2
                      ? "48.9%"
                      : "32.2%",
              }}
            >
            <TextureCard>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {list.nombre}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {t("shopping.itemsCount", { count: list.items_count })}
                    {list.pendientes > 0
                      ? ` · ${t("shopping.pendingCount", {
                          count: list.pendientes,
                        })}`
                      : ""}
                  </Text>
                </View>
                <Text style={{ color: colors.accent, fontSize: 20 }}>›</Text>
              </View>
            </TextureCard>
            </Pressable>
          ))}
        </View>
      </Screen>

      {createOpen ? (
        <BottomSheet
          visible
          onClose={() => setCreateOpen(false)}
          title={t("shopping.new")}
          footer={
            <Button
              label={saving ? t("common.loading") : t("shopping.create")}
              icon="check"
              onPress={() => void create()}
              disabled={saving}
            />
          }
        >
          <NativeContent>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <TextField
                value={name}
                onChangeText={setName}
                label={t("shopping.name")}
                placeholder={t("shopping.namePlaceholder")}
              />
            </View>
          </NativeContent>
        </BottomSheet>
      ) : null}
    </>
  );
}
