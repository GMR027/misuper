/** Search the catalog and hand a product back to the caller. */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { useTheme } from "@/components/theme";
import { apiFetch } from "@/lib/api";
import { formatCurrency, unitLabel } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import type { Producto } from "@/lib/products";

export function ProductPickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (product: Producto) => void;
}) {
  useLocale();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);

        const path =
          query.trim() === ""
            ? "/api/productos/frecuentes"
            : `/api/productos/buscar?q=${encodeURIComponent(query.trim())}`;

        void apiFetch<Producto[] | { items: Producto[] }>(path)
          .then((data) => {
            if (!alive) return;
            const items = Array.isArray(data)
              ? data
              : Array.isArray(data?.items)
                ? data.items
                : [];
            setItems(items.slice(0, 40));
          })
          .catch(() => {
            if (alive) setItems([]);
          })
          .finally(() => {
            if (alive) setLoading(false);
          });
      },
      query.trim() === "" ? 0 : 280,
    );

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("productPicker.title")}
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 12 }}>
          <TextField
            value={query}
            onChangeText={setQuery}
            label={t("productPicker.search")}
            placeholder={t("productPicker.placeholder")}
            leadingIcon="search"
          />

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Spinner />
            </View>
          ) : null}

          {error ? (
            <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
          ) : null}

          {!loading && items.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {t("productPicker.empty")}
            </Text>
          ) : null}

          {items.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => {
                onSelect(product);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 7,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.foreground,
                    fontSize: 12.5,
                    fontWeight: "600",
                  }}
                >
                  {product.nombre}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {`${product.categoria_nombre ?? t("quick.uncategorized")} · ${unitLabel(
                    product.unidad_base,
                  )}`}
                </Text>
              </View>
              {product.ultimo_precio != null && product.ultimo_precio > 0 ? (
                <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                  {`${formatCurrency(product.ultimo_precio)}/${unitLabel(
                    product.unidad_base,
                  )}`}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
