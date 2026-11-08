import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Column, Row } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/bottom-sheet";
import { CalculatorSheet } from "@/components/calculator-sheet";
import { CartSheet } from "@/components/cart-sheet";
import { NewProductSheet } from "@/components/new-product-sheet";
import { ProductGrid } from "@/components/product-card";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { ChipGrid, type ChipOption } from "@/components/m3/chips";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { Compose, M3Host } from "@/components/m3/host";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import {
  addProduct,
  clearCart,
  useCart,
  useCartCount,
  useCartTotal,
} from "@/lib/cart";
import { cartKcal } from "@/lib/nutrition";
import { readText, writeText } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import type { Categoria, Producto } from "@/lib/products";
import { showToast } from "@/lib/toast";

const FREQUENT = -1;
const VIEW_KEY = "misuper.quick.list";
let launchPromptShown = false;

export default function HomeScreen() {
  useLocale();
  const { colors } = useTheme();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [frecuentes, setFrecuentes] = useState<Producto[]>([]);
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [query, setQuery] = useState("");
  const [searchKey, setSearchKey] = useState(0);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [list, setList] = useState(() => readText(VIEW_KEY) === "1");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newKey, setNewKey] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartKey, setCartKey] = useState(0);
  const [calcProduct, setCalcProduct] = useState<Producto | null>(null);
  const [calcKey, setCalcKey] = useState(0);
  const count = useCartCount();
  const total = useCartTotal();
  const cart = useCart();
  const nutrition = cartKcal(cart);
  const searchSeq = useRef(0);
  const isFrequent = categoriaId === FREQUENT;
  const visible = isFrequent ? frecuentes : resultados;
  const searching = buscando && (query.trim() !== "" || categoriaId !== null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const [cats, freq] = await Promise.all([
          apiFetch<Categoria[]>("/api/categorias"),
          apiFetch<Producto[]>("/api/productos/frecuentes"),
        ]);

        if (!alive) return;

        setCategorias(Array.isArray(cats) ? cats : []);
        setFrecuentes(Array.isArray(freq) ? freq : []);
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();

    if (isFrequent || (q === "" && categoriaId === null)) {
      return;
    }

    const sequence = ++searchSeq.current;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();

      setBuscando(true);
      setError(null);

      if (q !== "") params.set("q", q);
      if (categoriaId !== null) params.set("categoria_id", String(categoriaId));

      void apiFetch<Producto[]>(`/api/productos/buscar?${params.toString()}`)
        .then((data) => {
          if (sequence !== searchSeq.current) return;
          setResultados(Array.isArray(data) ? data : []);
          setError(null);
        })
        .catch((caught) => {
          if (sequence !== searchSeq.current) return;
          setResultados([]);
          setError(apiErrorMessage(caught));
        })
        .finally(() => {
          if (sequence === searchSeq.current) setBuscando(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, categoriaId, isFrequent, reload]);

  useEffect(() => {
    if (launchPromptShown) return;
    launchPromptShown = true;

    if (cart.length === 0) return;

    Alert.alert(t("cart.unsavedTitle"), t("cart.unsavedBody"), [
      { text: t("cart.continue"), style: "cancel" },
      {
        text: t("cart.startNew"),
        style: "destructive",
        onPress: clearCart,
      },
    ]);
  }, [cart.length]);

  const refreshFrequent = async () => {
    try {
      const freq = await apiFetch<Producto[]>("/api/productos/frecuentes");
      setFrecuentes(Array.isArray(freq) ? freq : []);
    } catch {
      // The purchase is already saved; only the suggestion list is stale.
    }
  };

  const selectCategory = (value: number | null) => {
    setCategoriaId(value);
    setCategoriesOpen(false);
    setError(null);

    if (value === FREQUENT) {
      setQuery("");
      setSearchKey((key) => key + 1);
      setBuscando(false);
      return;
    }

    if (value === null && query.trim() === "") {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setError(null);

    if (value.trim() === "" && categoriaId === null) {
      setResultados([]);
      setBuscando(false);
    } else if (!isFrequent) {
      setBuscando(true);
    }
  };

  const openNew = () => {
    setNewKey((key) => key + 1);
    setNewProductOpen(true);
  };

  const openCart = () => {
    setCartKey((key) => key + 1);
    setCartOpen(true);
  };

  const openCalc = (product: Producto) => {
    setCalcKey((key) => key + 1);
    setCalcProduct(product);
  };

  const add = (product: Producto) => {
    if (!addProduct(product)) {
      showToast(t("cart.max"), "error");
      return;
    }

    showToast(t("quick.added", { name: product.nombre }), "success");
  };

  const toggleView = () => {
    const next = !list;
    setList(next);
    writeText(VIEW_KEY, next ? "1" : null);
  };

  const chipOptions: ChipOption<number | null>[] = [
    { value: FREQUENT, label: t("quick.frequentChip"), icon: "shopping-cart" },
    { value: null, label: t("quick.all") },
    ...categorias.map((categoria) => ({
      value: categoria.id,
      label: categoria.nombre,
    })),
  ];

  const title = isFrequent ? t("quick.frequent") : t("quick.results");
  const hasQuery = query.trim() !== "" || categoriaId !== null;
  const status = searching
    ? t("quick.loading")
    : visible.length > 0
      ? t("quick.itemCount", { count: visible.length })
      : "";

  return (
    <>
      <Screen
        title={t("quick.title")}
        stickyFirst
        footer={
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <M3Host matchContents>
              <SymbolIcon
                name="shopping-cart"
                size={20}
                tint={colors.accent}
                label={t("cart.title")}
              />
            </M3Host>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {t("cart.items", { count })}
                {nutrition.withData > 0 ? ` · ≈ ${nutrition.total} kcal` : ""}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 19,
                  fontWeight: "700",
                }}
              >
                {formatCurrency(total)}
              </Text>
            </View>
            <Pressable
              onPress={openCart}
              accessibilityRole="button"
              accessibilityLabel={t("cart.view")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: colors.accentContainer,
                borderWidth: 1,
                borderColor: colors.accent,
              }}
            >
              <Text
                style={{
                  color: colors.onAccentContainer,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {t("cart.view")}
              </Text>
              <Text
                style={{
                  color: colors.onAccentContainer,
                  fontSize: 16,
                  fontWeight: "700",
                  lineHeight: 16,
                }}
              >
                ›
              </Text>
            </Pressable>
          </View>
        }
      >
        <View
          style={{
            backgroundColor: colors.background,
            gap: 8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Row
              horizontalArrangement={{ spacedBy: 6 }}
              verticalAlignment="center"
              modifiers={[fillMaxWidth()]}
            >
              <TextField
              key={`search-${searchKey}`}
              value={query}
              onChangeText={changeQuery}
              label={t("quick.search")}
              placeholder={t("quick.searchPlaceholder")}
              leadingIcon="search"
              modifiers={[weight(1)]}
            />
            <IconButton
              icon="add"
              label={t("quick.newProduct")}
              onPress={openNew}
              variant="filled"
              size={44}
            />
              <IconButton
                icon="apps"
                label={t("quick.categories")}
                onPress={() => setCategoriesOpen(true)}
                variant="outlined"
                size={44}
                color={categoriaId !== null ? colors.accent : undefined}
              />
            </Row>
          </Compose>
          <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), padding(2, 0, 2, 0)]}
            >
              <M3Text variant="subtitle" maxLines={1} modifiers={[weight(1)]}>
                {title}
              </M3Text>
              <M3Text variant="caption" color="muted" maxLines={1}>
                {status}
              </M3Text>
              <IconButton
                icon={list ? "grid-view" : "list"}
                label={list ? t("quick.gridView") : t("quick.listView")}
                onPress={toggleView}
                variant="standard"
                size={36}
                iconSize={20}
              />
            </Row>
          </Compose>
        </View>

        {searching && !isFrequent ? (
          <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth()]}
            >
              <Spinner />
              <M3Text variant="caption" color="muted">
                {t("quick.loading")}
              </M3Text>
            </Row>
          </Compose>
        ) : null}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}

        {!searching && visible.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              gap: 10,
              paddingVertical: 28,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.borderStrong,
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {isFrequent
                ? t("quick.frequentEmpty")
                : hasQuery
                  ? t("quick.noResults")
                  : t("quick.empty")}
            </Text>
            {hasQuery || isFrequent ? (
              <Button
                label={t("quick.newProduct")}
                icon="add"
                onPress={openNew}
              />
            ) : null}
          </View>
        ) : null}

        {visible.length > 0 ? (
          <ProductGrid
            products={visible}
            categorias={categorias}
            onAdd={add}
            onCalc={openCalc}
            list={list}
          />
        ) : null}
      </Screen>

      <BottomSheet
        visible={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title={t("quick.categories")}
      >
        <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}>
          <ChipGrid
            options={chipOptions}
            value={categoriaId}
            onChange={selectCategory}
          />
        </Column>
      </BottomSheet>

      <NewProductSheet
        key={`new-${newKey}`}
        visible={newProductOpen}
        categorias={categorias}
        onClose={() => setNewProductOpen(false)}
        onAdded={() => {
          showToast(t("productForm.created"), "success");
          setReload((value) => value + 1);
        }}
      />

      <CartSheet
        key={`cart-${cartKey}`}
        visible={cartOpen}
        onClose={() => setCartOpen(false)}
        onSaved={() => {
          showToast(t("cart.saved"), "success");
          void refreshFrequent();
        }}
      />

      <CalculatorSheet
        key={`calc-${calcKey}`}
        visible={calcProduct !== null}
        product={calcProduct}
        onClose={() => setCalcProduct(null)}
        onAdded={() => {
          if (calcProduct) {
            showToast(
              t("quick.added", { name: calcProduct.nombre }),
              "success",
            );
          }
        }}
      />
    </>
  );
}
