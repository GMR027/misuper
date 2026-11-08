import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { ListScreen } from "@/components/list-screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface AdminUsuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  debe_cambiar_password: boolean;
  created_at: string;
}

interface UsuariosPage {
  items: AdminUsuario[];
  total: number;
  page: number;
  per_page: number;
}

export default function AdminUsersScreen() {
  useLocale();
  const { colors } = useTheme();
  const [items, setItems] = useState<AdminUsuario[]>([]);
  const [query, setQuery] = useState("");
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

        void apiFetch<UsuariosPage>(`/api/admin/usuarios?${params.toString()}`)
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
  }, [query]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const params = new URLSearchParams({ page: String(next) });
      if (query.trim() !== "") params.set("q", query.trim());
      const data = await apiFetch<UsuariosPage>(
        `/api/admin/usuarios?${params.toString()}`,
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

  const reset = async (user: AdminUsuario) => {
    setBusy(user.id);
    try {
      const data = await apiFetch<{
        password_temporal: string;
        email: string;
      }>(`/api/admin/usuarios/${user.id}/reset-password`, {
        method: "POST",
      });
      Alert.alert(
        t("admin.resetTitle"),
        t("admin.resetBody", {
          email: data.email,
          password: data.password_temporal,
        }),
      );
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = (user: AdminUsuario) => {
    Alert.alert(t("admin.deleteTitle"), t("admin.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(user.id);
            try {
              await apiFetch<unknown>(`/api/admin/usuarios/${user.id}`, {
                method: "DELETE",
              });
              setItems((current) =>
                current.filter((item) => item.id !== user.id),
              );
              setTotal((current) => Math.max(0, current - 1));
              showToast(t("admin.userDeleted"), "success");
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
        label={t("admin.searchUsers")}
        placeholder={t("admin.searchUsersPlaceholder")}
        leadingIcon="search"
      />
      <Text style={{ color: colors.muted, fontSize: 10.5 }}>
        {t("admin.userCount", { count: total })}
      </Text>
      {loading ? <Spinner /> : null}
      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );

  return (
    <ListScreen
      title={t("admin.users")}
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
                numberOfLines={1}
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
                    item.rol === "admin" ? colors.accent : colors.muted,
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                {item.rol === "admin" ? t("admin.roleAdmin") : t("admin.roleUser")}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 10.5 }}>
              {item.email}
            </Text>
            {item.debe_cambiar_password ? (
              <Text style={{ color: colors.warning, fontSize: 9.5 }}>
                {t("admin.mustChangePassword")}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, paddingTop: 3 }}>
              <Button
                label={
                  busy === item.id
                    ? t("common.loading")
                    : t("admin.resetPassword")
                }
                variant="outlined"
                icon="refresh"
                onPress={() => void reset(item)}
                disabled={busy === item.id}
              />
              <Button
                label={t("admin.delete")}
                variant="outlined"
                icon="delete"
                onPress={() => remove(item)}
                disabled={busy === item.id}
              />
            </View>
          </View>
        </TextureCard>
      )}
    />
  );
}
