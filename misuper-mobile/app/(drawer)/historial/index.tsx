import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getLocale, t, useLocale } from "@/lib/i18n";

interface CompraSummary {
  id: number;
  fecha: string;
  total: number;
  comercio: string | null;
  items_count: number;
  ticket_id: number | null;
  ticket_titulo: string | null;
  kcal_total: number;
  kcal_sin_dato: number;
}

interface HistoryPage {
  items: CompraSummary[];
  total: number;
  page: number;
  per_page: number;
}

function monthLabel(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  return new Intl.DateTimeFormat(getLocale() === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function dayLabel(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  return new Intl.DateTimeFormat(getLocale() === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export default function HistoryScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<CompraSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<HistoryPage>("/api/compras?page=1");

        if (!alive) return;

        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total);
        setPage(1);
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

  const loadMore = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const next = page + 1;
      const data = await apiFetch<HistoryPage>(`/api/compras?page=${next}`);
      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
      setPage(next);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = new Map<string, CompraSummary[]>();

  for (const compra of items) {
    const key = compra.fecha.slice(0, 7);
    const group = groups.get(key);
    if (group) group.push(compra);
    else groups.set(key, [compra]);
  }

  return (
    <Screen title={t("history.title")}>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        {t("history.subtitle")}
      </Text>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <Spinner />
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <TextureCard>
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              textAlign: "center",
              paddingVertical: 14,
            }}
          >
            {t("history.empty")}
          </Text>
        </TextureCard>
      ) : null}

      {[...groups.entries()].map(([key, compras]) => (
        <View key={key} style={{ gap: 8 }}>
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              paddingHorizontal: 4,
              paddingTop: 4,
            }}
          >
            {monthLabel(`${key}-01`)}
          </Text>

          {compras.map((compra) => {
            const title =
              compra.comercio?.trim() !== ""
                ? (compra.comercio as string)
                : compra.ticket_titulo?.trim() !== ""
                  ? (compra.ticket_titulo as string)
                  : t("history.purchase");

            return (
              <Pressable
                key={compra.id}
                onPress={() => router.push(`/historial/${compra.id}`)}
              >
                <TextureCard>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
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
                        {title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.muted, fontSize: 11 }}
                      >
                        {`${dayLabel(compra.fecha)} · ${t("history.itemsCount", {
                          count: compra.items_count,
                        })}`}
                      </Text>
                      {compra.kcal_total > 0 ? (
                        <Text style={{ color: colors.muted, fontSize: 10 }}>
                          {`${Math.round(compra.kcal_total)} kcal`}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 15,
                          fontWeight: "700",
                        }}
                      >
                        {formatCurrency(compra.total)}
                      </Text>
                      <Text style={{ color: colors.accent, fontSize: 18 }}>
                        ›
                      </Text>
                    </View>
                  </View>
                </TextureCard>
              </Pressable>
            );
          })}
        </View>
      ))}

      {items.length > 0 && items.length < total ? (
        <Button
          label={loadingMore ? t("common.loading") : t("history.loadMore")}
          variant="outlined"
          icon="refresh"
          onPress={() => void loadMore()}
          disabled={loadingMore}
        />
      ) : null}
    </Screen>
  );
}
