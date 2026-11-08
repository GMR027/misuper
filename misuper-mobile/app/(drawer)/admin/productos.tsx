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

interface AdminProducto {
  id: number;
  nombre: string;
  categoria_nombre: string | null;
  unidad_base: string;
  estado: string;
}

interface ProductosPage {
  items: AdminProducto[];
  total: number;
  page: number;
  per_page: number;
}

const STATES = ["todos", "activo", "inactivo"] as const;

export default function AdminProductsScreen() {
  useLocale();
  const { colors } = useTheme();
  const [items, setItems] = useState<AdminProducto[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATES)[number]>("todos");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: "1" });
        if (query.trim() !== "") params.set("q", query.trim());
        if (status !== "todos") params.set("estado", status);

        void apiFetch<ProductosPage>(`/api/admin/productos?${params.toString()}`)
          .then((data) => {
            if (!alive) return;
            setItems(Array.isArray(data.items) ? data.items : []);
            setTotal(data.total);
            setPage(1);
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
      query.trim() === "" ? 0 : 300,
    );

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, status]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      const next = page + 1;
      const params = new URLSearchParams({ page: String(next) });
      if (query.trim() !== "") params.set("q", query.trim());
      if (status !== "todos") params.set("estado", status);
      const data = await apiFetch<ProductosPage>(
        `/api/admin/productos?${params.toString()}`,
      );
      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
      setPage(next);
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (item: AdminProducto) => {
    const run = () => {
      void (async () => {
        setBusy(item.id);
        try {
          if (item.estado === "activo") {
            await apiFetch<unknown>(`/api/admin/productos/${item.id}`, {
              method: "DELETE",
            });
          } else {
            await apiFetch<unknown>(`/api/admin/productos/${item.id}/activar`, {
              method: "POST",
            });
          }

          setItems((current) =>
            current.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    estado: row.estado === "activo" ? "inactivo" : "activo",
                  }
                : row,
            ),
          );
          showToast(t("admin.productUpdated"), "success");
        } catch (caught) {
          showToast(apiErrorMessage(caught), "error");
        } finally {
          setBusy(null);
        }
      })();
    };

    if (item.estado === "activo") {
      Alert.alert(t("admin.deactivateTitle"), t("admin.deactivateBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("admin.deactivate"), style: "destructive", onPress: run },
      ]);
    } else {
      run();
    }
  };

  const header = (
    <View style={{ gap: 8, paddingBottom: 4 }}>
      <TextField
        value={query}
        onChangeText={setQuery}
        label={t("admin.searchProducts")}
        placeholder={t("admin.searchProductsPlaceholder")}
        leadingIcon="search"
      />
      <View style={{ flexDirection: "row", gap: 6 }}>
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
        {t("admin.productCount", { count: total })}
      </Text>
      {loading ? <Spinner /> : null}
      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );

  return (
    <ListScreen
      title={t("admin.products")}
      data={items}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      ListFooterComponent={
        items.length < total ? (
          <Button
            label={loadingMore ? t("common.loading") : t("admin.loadMore")}
            variant="outlined"
            icon="refresh"
            onPress={() => void loadMore()}
            disabled={loadingMore}
          />
        ) : null
      }
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
                    item.estado === "activo" ? colors.success : colors.muted,
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                {t(`admin.state.${item.estado}`)}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 10.5 }}>
              {`${item.categoria_nombre ?? t("quick.uncategorized")} · ${
                item.unidad_base
              }`}
            </Text>
            <Button
              label={
                busy === item.id
                  ? t("common.loading")
                  : item.estado === "activo"
                    ? t("admin.deactivate")
                    : t("admin.activate")
              }
              variant="outlined"
              icon={item.estado === "activo" ? "delete" : "check"}
              onPress={() => void toggle(item)}
              disabled={busy === item.id}
            />
          </View>
        </TextureCard>
      )}
    />
  );
}
