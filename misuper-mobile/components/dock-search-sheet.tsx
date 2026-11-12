/** The central dock button's global product search. */

import { Fragment, useEffect, useRef, useState } from "react";
import { Column, Row } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useRouter } from "expo-router";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button, IconButton } from "@/components/m3/buttons";
import { Card, Divider } from "@/components/m3/card";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { ListRow } from "@/components/m3/lists";
import { M3Text } from "@/components/m3/text";
import { NativeContent } from "@/components/m3/host";
import { ProductThumb } from "@/components/product-card";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { addProduct } from "@/lib/cart";
import { formatCurrency, unitLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Producto } from "@/lib/products";
import { showToast } from "@/lib/toast";

export function DockSearchSheet({
  visible,
  onClose,
  onCalc,
}: {
  visible: boolean;
  onClose: () => void;
  onCalc: (product: Producto) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const q = query.trim();

    if (q === "") return;

    const current = ++sequence.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void apiFetch<Producto[] | { items: Producto[] }>(
        `/api/productos/buscar?q=${encodeURIComponent(q)}`,
      )
        .then((data) => {
          if (current !== sequence.current) return;
          setResults(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
        })
        .catch((caught) => {
          if (current !== sequence.current) return;
          setResults([]);
          setError(apiErrorMessage(caught));
        })
        .finally(() => {
          if (current === sequence.current) setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const add = (product: Producto) => {
    if (!addProduct(product)) {
      showToast(t("cart.max"), "error");
      return;
    }
    showToast(t("quick.added", { name: product.nombre }), "success");
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("dock.searchTitle")}
      footer={
        <Button
          label={t("dock.goHome")}
          variant="outlined"
          icon="home"
          onPress={() => {
            onClose();
            router.navigate("/");
          }}
        />
      }
    >
      <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
        <TextField
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (value.trim() === "") {
              setResults([]);
              setLoading(false);
              setError(null);
            }
          }}
          label={t("quick.search")}
          placeholder={t("dock.searchPlaceholder")}
          leadingIcon="search"
        />
      </Column>

      {loading ? (
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), padding(16, 4, 16, 8)]}
        >
          <Spinner />
          <M3Text variant="caption" color="muted">
            {t("quick.loading")}
          </M3Text>
        </Row>
      ) : null}

      {error ? (
        <M3Text
          variant="caption"
          color="error"
          modifiers={[padding(16, 4, 16, 8)]}
        >
          {error}
        </M3Text>
      ) : null}

      {!loading && !error && query.trim() !== "" && results.length === 0 ? (
        <M3Text
          variant="caption"
          color="muted"
          modifiers={[padding(16, 4, 16, 8)]}
        >
          {t("quick.noResults")}
        </M3Text>
      ) : null}

      {results.length > 0 ? (
        <Row modifiers={[fillMaxWidth(), padding(12, 0, 12, 8)]}>
          <Card>
            {results.map((product, index) => (
              <Fragment key={product.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  title={product.nombre}
                  summary={[
                    product.categoria_nombre ?? t("quick.uncategorized"),
                    unitLabel(product.unidad_base),
                    product.ultimo_precio
                      ? `${formatCurrency(product.ultimo_precio)}/${unitLabel(
                          product.unidad_base,
                        )}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={() => add(product)}
                  leading={
                    <NativeContent wrap>
                      <ProductThumb product={product} size={44} />
                    </NativeContent>
                  }
                  trailing={
                    <Row horizontalArrangement={{ spacedBy: 2 }}>
                      <IconButton
                        icon="add"
                        label={t("quick.add")}
                        onPress={() => add(product)}
                        size={34}
                        iconSize={18}
                      />
                      <IconButton
                        icon="calculate"
                        label={t("quick.calculate")}
                        onPress={() => {
                          onClose();
                          onCalc(product);
                        }}
                        variant="outlined"
                        size={34}
                        iconSize={18}
                      />
                    </Row>
                  }
                />
              </Fragment>
            ))}
          </Card>
        </Row>
      ) : null}
    </BottomSheet>
  );
}
