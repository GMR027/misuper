import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Spinner } from "@/components/m3/feedback";
import { apiErrorMessage, apiFetch, getApiUrl } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatars";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { getLocale, t, useLocale } from "@/lib/i18n";

interface GastoMes {
  mes: number;
  total: number;
}

interface GastoAnual {
  anio: number;
  total: number;
  anios: { anio: number; total: number }[];
  anio_anterior: number;
  total_anterior: number;
  variacion_porcentual: number | null;
  promedio_anteriores: number | null;
}

interface TopProducto {
  producto_id: number | null;
  nombre: string;
  imagen_url: string | null;
  gasto: number;
  cantidad_total: number;
}

function monthShort(month: number): string {
  return new Intl.DateTimeFormat(getLocale() === "es" ? "es-MX" : "en-US", {
    month: "short",
  }).format(new Date(2020, month - 1, 1));
}

function monthLong(month: number): string {
  return new Intl.DateTimeFormat(getLocale() === "es" ? "es-MX" : "en-US", {
    month: "long",
  }).format(new Date(2020, month - 1, 1));
}

export default function MetricsScreen() {
  useLocale();
  const { colors } = useTheme();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState<GastoMes[]>([]);
  const [annual, setAnnual] = useState<GastoAnual | null>(null);
  const [top, setTop] = useState<TopProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const years = Array.from(
    { length: Math.max(1, now.getFullYear() - 2019) },
    (_, index) => 2020 + index,
  );

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void Promise.all([
        apiFetch<GastoMes[]>(`/api/metricas/gasto-mensual?anio=${year}`),
        apiFetch<GastoAnual>(`/api/metricas/gasto-anual?anio=${year}`),
      ])
        .then(([meses, anio]) => {
          if (!alive) return;
          setMonthly(Array.isArray(meses) ? meses : []);
          setAnnual(anio);
        })
        .catch((caught) => {
          if (alive) setError(apiErrorMessage(caught));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [year]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setTopLoading(true);

      void apiFetch<TopProducto[]>(
        `/api/metricas/top-productos?mes=${month}&anio=${year}`,
      )
        .then((data) => {
          if (alive) setTop(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (alive) setTop([]);
        })
        .finally(() => {
          if (alive) setTopLoading(false);
        });
    }, 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [month, year]);

  const months = Array.from({ length: 12 }, (_, index) => {
    const value = index + 1;
    return {
      mes: value,
      total: monthly.find((item) => item.mes === value)?.total ?? 0,
    };
  });
  const maxMonth = Math.max(1, ...months.map((item) => item.total));
  const maxYear = Math.max(1, ...(annual?.anios.map((item) => item.total) ?? [1]));
  const variation = annual?.variacion_porcentual ?? null;
  const totalYear = monthly.reduce((sum, item) => sum + item.total, 0);
  const averageMonthly = monthly.length > 0 ? totalYear / monthly.length : 0;
  const bestMonth = monthly.reduce(
    (best, item) => (item.total > best.total ? item : best),
    monthly[0] ?? { mes: 0, total: 0 },
  );

  return (
    <Screen title={t("metrics.title")}>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
        {t("metrics.subtitle")}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
      >
        {years.map((value) => {
          const active = value === year;
          return (
            <Pressable
              key={value}
              onPress={() => setYear(value)}
              style={{
                height: 34,
                minWidth: 60,
                paddingHorizontal: 12,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active ? colors.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: active ? colors.onAccent : colors.foreground,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {value}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Spinner />
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}

      <TextureCard>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {t("metrics.yearTotal", { year })}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 28,
                fontWeight: "800",
              }}
            >
              {formatCurrency(annual?.total ?? 0)}
            </Text>
          </View>
          {variation !== null ? (
            <Text
              style={{
                color:
                  variation > 0
                    ? colors.error
                    : variation < 0
                      ? colors.success
                      : colors.muted,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {`${variation > 0 ? "+" : ""}${variation.toFixed(1)}%`}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            height: 130,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 5,
            paddingTop: 8,
          }}
        >
          {months.map((item) => {
            const height = item.total > 0 ? Math.max(4, (item.total / maxMonth) * 110) : 3;
            const active = item.mes === now.getMonth() + 1 && year === now.getFullYear();
            return (
              <View key={item.mes} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <View
                  style={{
                    width: "100%",
                    height,
                    borderRadius: 4,
                    backgroundColor: active ? colors.accent : colors.accentContainer,
                  }}
                />
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {monthShort(item.mes)}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 12, paddingTop: 2 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              {t("metrics.averageMonthly")}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {monthly.length > 0
                ? formatCurrency(averageMonthly)
                : t("metrics.noData")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              {t("metrics.bestMonth")}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {bestMonth.mes > 0
                ? `${monthLong(bestMonth.mes)} · ${formatCurrency(bestMonth.total)}`
                : t("metrics.noData")}
            </Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          {t("metrics.monthlyHint")}
        </Text>
      </TextureCard>

      {annual ? (
        <TextureCard>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {t("metrics.annualComparison")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 10,
              height: 110,
              paddingTop: 6,
            }}
          >
            {annual.anios.map((item) => {
              const height = Math.max(4, (item.total / maxYear) * 80);
              const active = item.anio === annual.anio;
              return (
                <View key={item.anio} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {formatCurrency(item.total)}
                  </Text>
                  <View
                    style={{
                      width: "100%",
                      height,
                      borderRadius: 5,
                      backgroundColor: active ? colors.accent : colors.accentContainer,
                    }}
                  />
                  <Text
                    style={{
                      color: active ? colors.accent : colors.muted,
                      fontSize: 11.5,
                      fontWeight: active ? "800" : "500",
                    }}
                  >
                    {item.anio}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {t("metrics.previousYear", { year: annual.anio_anterior })}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
                {formatCurrency(annual.total_anterior)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {t("metrics.averagePrevious")}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
                {annual.promedio_anteriores === null
                  ? "—"
                  : formatCurrency(annual.promedio_anteriores)}
              </Text>
            </View>
          </View>
        </TextureCard>
      ) : null}

      <TextureCard>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              flex: 1,
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {t("metrics.topProducts")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {monthLong(month)} {year}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => {
            const active = value === month;
            return (
              <Pressable
                key={value}
                onPress={() => setMonth(value)}
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
                    fontSize: 12,
                    fontWeight: active ? "700" : "500",
                  }}
                >
                  {monthShort(value)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {topLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 14 }}>
            <Spinner />
          </View>
        ) : null}

        {!topLoading && top.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 8 }}>
            {t("metrics.noTop")}
          </Text>
        ) : null}

        {top.map((item, index) => {
          const image = resolveMediaUrl(item.imagen_url, getApiUrl());
          return (
            <View
              key={`${item.producto_id ?? "free"}-${item.nombre}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                paddingVertical: 6,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  width: 18,
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {index + 1}
              </Text>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: colors.accentContainer,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={{ width: 34, height: 34 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={{
                      color: colors.accent,
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    {item.nombre.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.foreground,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {item.nombre}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {formatQuantity(item.cantidad_total)}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {formatCurrency(item.gasto)}
              </Text>
            </View>
          );
        })}
      </TextureCard>
    </Screen>
  );
}
