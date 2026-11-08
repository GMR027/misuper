import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { ListScreen } from "@/components/list-screen";
import { PriceDetailSheet } from "@/components/price-detail-sheet";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch, getApiUrl } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatars";
import { formatCurrency, unitLabel } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";

interface PrecioItem {
  id: number;
  nombre: string;
  categoria_nombre: string;
  unidad_base: string;
  imagen_url: string | null;
  precio: number | null;
  muestras: number;
  fecha: string | null;
  comercio: string | null;
  origen: string | null;
  viejo: boolean;
  actualizado_at: string | null;
}

interface PreciosResumen {
  total: number;
  con_precio: number;
  sin_precio: number;
  viejos: number;
  manuales: number;
}

interface PreciosResponse {
  items: PrecioItem[];
  resumen: PreciosResumen;
  comercios: string[];
}

const STATUS = [
  ["todos", "prices.all"],
  ["con-precio", "prices.withPrice"],
  ["sin-precio", "prices.withoutPrice"],
  ["viejos", "prices.old"],
  ["manuales", "prices.manual"],
] as const;

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}

export default function PricesScreen() {
  useLocale();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS)[number][0]>("todos");
  const [items, setItems] = useState<PrecioItem[]>([]);
  const [summary, setSummary] = useState<PreciosResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrecioItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (query.trim() !== "") params.set("q", query.trim());
        params.set("estado", status);

        void apiFetch<PreciosResponse>(`/api/precios?${params.toString()}`)
          .then((data) => {
            if (!alive) return;
            setItems(Array.isArray(data.items) ? data.items : []);
            setSummary(data.resumen ?? null);
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
  }, [query, status, refreshKey]);

  const header = (
    <View style={{ gap: 9, paddingBottom: 4 }}>
      <TextField
        value={query}
        onChangeText={setQuery}
        label={t("prices.search")}
        placeholder={t("prices.searchPlaceholder")}
        leadingIcon="search"
      />

      {summary ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 10.5 }}>
            {t("prices.summaryTotal", { count: summary.total })}
          </Text>
          <Text style={{ color: colors.success, fontSize: 10.5 }}>
            {t("prices.summaryWithPrice", { count: summary.con_precio })}
          </Text>
          <Text style={{ color: colors.warning, fontSize: 10.5 }}>
            {t("prices.summaryWithoutPrice", { count: summary.sin_precio })}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10.5 }}>
            {t("prices.summaryOld", { count: summary.viejos })}
          </Text>
          <Text style={{ color: colors.accent, fontSize: 10.5 }}>
            {t("prices.summaryManual", { count: summary.manuales })}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {STATUS.map(([value, key]) => (
          <Chip
            key={value}
            label={t(key)}
            active={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 10.5 }}>
          {t("prices.results", { count: items.length })}
        </Text>
        {loading ? <Spinner /> : null}
      </View>

      {error ? (
        <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );

  return (
    <>
      <ListScreen
        title={t("prices.title")}
        data={items}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loading && !error ? (
            <TextureCard>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  textAlign: "center",
                  paddingVertical: 14,
                }}
              >
                {t("prices.empty")}
              </Text>
            </TextureCard>
          ) : null
        }
        renderItem={({ item }) => {
          const image = resolveMediaUrl(item.imagen_url, getApiUrl());
          return (
            <Pressable onPress={() => setSelected(item)}>
              <TextureCard style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: colors.accentContainer,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        style={{ width: 46, height: 46 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{
                          color: colors.accent,
                          fontSize: 19,
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
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {item.nombre}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5 }}>
                      {`${item.categoria_nombre} · ${item.unidad_base}`}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                      {item.viejo ? (
                        <Text style={{ color: colors.warning, fontSize: 9, fontWeight: "700" }}>
                          {t("prices.oldBadge")}
                        </Text>
                      ) : null}
                      {item.origen === "manual" ? (
                        <Text style={{ color: colors.accent, fontSize: 9, fontWeight: "700" }}>
                          {t("prices.manualBadge")}
                        </Text>
                      ) : null}
                      {item.muestras > 0 ? (
                        <Text style={{ color: colors.muted, fontSize: 9 }}>
                          {t("prices.sampleCount", { count: item.muestras })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text
                      style={{
                        color: item.precio === null ? colors.muted : colors.foreground,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {item.precio === null
                        ? t("prices.noPrice")
                        : `${formatCurrency(item.precio)}/${unitLabel(item.unidad_base)}`}
                    </Text>
                    {item.fecha ? (
                      <Text style={{ color: colors.muted, fontSize: 9.5 }}>
                        {item.fecha}
                      </Text>
                    ) : null}
                    {item.comercio ? (
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.muted, fontSize: 9.5 }}
                      >
                        {item.comercio}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </TextureCard>
            </Pressable>
          );
        }}
      />

      {selected ? (
        <PriceDetailSheet
          visible
          productId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />
      ) : null}
    </>
  );
}
