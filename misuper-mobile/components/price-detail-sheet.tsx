/** Product price detail and manual price editor. */

import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatCurrency, formatQuantity, unitLabel } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface PrecioVigente {
  precio: number;
  muestras: number;
  fecha: string | null;
  comercio: string | null;
  origen: string;
  viejo: boolean;
  actualizado_at: string | null;
}

interface HistorialItem {
  fecha: string;
  cantidad: number;
  precio_total: number;
  unidad: string;
  precio_unidad: number | null;
  precio_base: number | null;
  comercio: string | null;
  compatible: boolean;
}

interface PrecioDetalle {
  producto: {
    id: number;
    nombre: string;
    unidad_base: string;
    categoria_nombre: string | null;
    imagen_url: string | null;
  };
  precio: PrecioVigente | null;
  manual: { precio_unidad: number; updated_at: string } | null;
  historial: HistorialItem[];
  comercios: string[];
}

export function PriceDetailSheet({
  visible,
  productId,
  onClose,
  onChanged,
}: {
  visible: boolean;
  productId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  useLocale();
  const { colors } = useTheme();
  const [data, setData] = useState<PrecioDetalle | null>(null);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const result = await apiFetch<PrecioDetalle>(`/api/precios/${productId}`);
      setData(result);
      setManual(
        result.manual
          ? String(result.manual.precio_unidad)
          : result.precio
            ? String(result.precio.precio)
            : "",
      );
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
        const result = await apiFetch<PrecioDetalle>(`/api/precios/${productId}`);

        if (!alive) return;

        setData(result);
        setManual(
          result.manual
            ? String(result.manual.precio_unidad)
            : result.precio
              ? String(result.precio.precio)
              : "",
        );
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [productId]);

  const save = async () => {
    if (saving) return;

    const value = Number(manual.trim().replace(",", "."));

    if (!Number.isFinite(value) || value < 0) {
      setError(t("prices.priceInvalid"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch<unknown>(`/api/precios/${productId}/manual`, {
        method: "POST",
        body: { precio_unidad: value },
      });
      await load();
      onChanged();
      showToast(t("prices.saved"), "success");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      await apiFetch<unknown>(`/api/precios/${productId}/manual`, {
        method: "DELETE",
      });
      await load();
      onChanged();
      showToast(t("prices.removed"), "success");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const price = data?.precio;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("prices.detailTitle")}
      footer={
        <Button
          label={saving ? t("common.loading") : t("prices.saveManual")}
          icon="check"
          onPress={() => void save()}
          disabled={saving || loading}
        />
      }
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 12 }}>
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Spinner />
            </View>
          ) : null}

          {error ? (
            <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
          ) : null}

          {data ? (
            <>
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 17,
                    fontWeight: "800",
                  }}
                >
                  {data.producto.nombre}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {`${data.producto.categoria_nombre ?? ""} · ${
                    data.producto.unidad_base
                  }`}
                </Text>
              </View>

              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                  {t("prices.currentPrice")}
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 24,
                    fontWeight: "800",
                  }}
                >
                  {price
                    ? `${formatCurrency(price.precio)}/${unitLabel(
                        data.producto.unidad_base,
                      )}`
                    : "—"}
                </Text>
                {price ? (
                  <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                    {`${price.muestras} ${t("prices.samples")}${
                      price.fecha ? ` · ${price.fecha}` : ""
                    }${price.comercio ? ` · ${price.comercio}` : ""}`}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 5, paddingTop: 3 }}>
                  {price?.viejo ? (
                    <Text
                      style={{
                        color: colors.warning,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {t("prices.oldBadge")}
                    </Text>
                  ) : null}
                  {price?.origen === "manual" ? (
                    <Text
                      style={{
                        color: colors.accent,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {t("prices.manualBadge")}
                    </Text>
                  ) : null}
                </View>
              </View>

              <TextField
                value={manual}
                onChangeText={setManual}
                label={t("prices.manualPrice")}
                keyboardType="decimal"
                prefix="$"
              />

              {data.manual ? (
                <Button
                  label={t("prices.removeManual")}
                  variant="outlined"
                  icon="delete"
                  onPress={() => void remove()}
                  disabled={saving}
                />
              ) : null}

              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 13,
                  fontWeight: "700",
                  paddingTop: 2,
                }}
              >
                {t("prices.history")}
              </Text>

              {data.historial.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {t("prices.noHistory")}
                </Text>
              ) : null}

              {data.historial.map((item, index) => (
                <View
                  key={`${item.fecha}-${index}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 5,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 11.5 }}>
                      {item.fecha}
                      {item.comercio ? ` · ${item.comercio}` : ""}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                      {`${formatQuantity(item.cantidad)} ${
                        item.unidad
                      } · ${formatCurrency(item.precio_total)}`}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: item.compatible
                        ? colors.foreground
                        : colors.warning,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {item.precio_base === null
                      ? t("prices.incompatible")
                      : `${formatCurrency(item.precio_base)}/${unitLabel(
                          data.producto.unidad_base,
                        )}`}
                  </Text>
                </View>
              ))}

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {t("prices.hint")}
              </Text>
            </>
          ) : null}
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
