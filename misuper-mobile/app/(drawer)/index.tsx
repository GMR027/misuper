import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Column, Row } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/bottom-sheet";
import { CalculatorSheet } from "@/components/calculator-sheet";
import { CartSheet } from "@/components/cart-sheet";
import { NewProductSheet } from "@/components/new-product-sheet";
import { PendingBadge } from "@/components/pending-badge";
import { ProductGrid } from "@/components/product-card";
import { VoiceCartSheet } from "@/components/voice-cart-sheet";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { ChipGrid, type ChipOption } from "@/components/m3/chips";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { Compose, M3Host } from "@/components/m3/host";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { apiErrorMessage } from "@/lib/api";
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
import {
  buscarProductos,
  leerCategorias,
  leerFrecuentes,
  syncCatalogo,
  syncFrecuentes,
} from "@/lib/offline/catalog";
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
  const [page, setPage] = useState(1);
  const [totalResultados, setTotalResultados] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [sinConexion, setSinConexion] = useState(false);
  const [sinCatalogo, setSinCatalogo] = useState(false);
  const [reload, setReload] = useState(0);
  const [list, setList] = useState(() => readText(VIEW_KEY) === "1");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newKey, setNewKey] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartKey, setCartKey] = useState(0);
  const [calcProduct, setCalcProduct] = useState<Producto | null>(null);
  const [calcKey, setCalcKey] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceKey, setVoiceKey] = useState(0);
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
      // 1. Paint what the phone already has, without waiting for the network.
      try {
        const [cats, freq] = await Promise.all([
          leerCategorias(),
          leerFrecuentes(),
        ]);

        if (!alive) return;

        if (cats.length > 0) setCategorias(cats);
        if (freq.length > 0) setFrecuentes(freq);
      } catch {
        // First run: there is no local copy yet, the network fills it below.
      }

      // 2. Refresh the catalog snapshot and the frequent list when online.
      try {
        const cambiado = await syncCatalogo();
        const cats = cambiado ? await leerCategorias() : null;

        if (alive && cats !== null) setCategorias(cats);

        const freq = await syncFrecuentes();

        if (alive) setFrecuentes(freq);
      } catch {
        // Offline: the cached copy painted above is the best answer.
      }
    })();

    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    const q = query.trim();

    if (isFrequent || (q === "" && categoriaId === null)) {
      return;
    }

    const sequence = ++searchSeq.current;
    const timer = setTimeout(() => {
      setBuscando(true);
      setError(null);

      void buscarProductos(q, categoriaId, page)
        .then((data) => {
          if (sequence !== searchSeq.current) return;

          const items = Array.isArray(data?.items) ? data.items : [];
          const nextTotal = Number(data?.total ?? 0);

          setResultados(items);
          setTotalResultados(nextTotal);
          setPerPage(Number(data?.per_page ?? 20));
          setSinConexion(data.fuente === "local");
          setSinCatalogo(data.sin_catalogo === true);
          setError(null);

          if (page > 1 && nextTotal > 0 && items.length === 0) {
            setPage(1);
          }
        })
        .catch((caught) => {
          if (sequence !== searchSeq.current) return;

          setResultados([]);
          setTotalResultados(0);
          setSinConexion(false);
          setSinCatalogo(false);
          setError(apiErrorMessage(caught));
        })
        .finally(() => {
          if (sequence === searchSeq.current) setBuscando(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, categoriaId, isFrequent, reload, page]);

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
      setFrecuentes(await syncFrecuentes());
    } catch {
      // The purchase is already saved; only the suggestion list is stale.
    }
  };

  const limpiarAviso = () => {
    setSinConexion(false);
    setSinCatalogo(false);
  };

  const selectCategory = (value: number | null) => {
    setCategoriaId(value);
    setCategoriesOpen(false);
    setError(null);
    setPage(1);
    limpiarAviso();

    if (value === FREQUENT) {
      setQuery("");
      setSearchKey((key) => key + 1);
      setBuscando(false);
      return;
    }

    if (value === null && query.trim() === "") {
      setResultados([]);
      setTotalResultados(0);
      setBuscando(false);
      return;
    }

    setBuscando(true);
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setError(null);
    setPage(1);
    limpiarAviso();

    if (value.trim() === "" && categoriaId === null) {
      setResultados([]);
      setTotalResultados(0);
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

  const openVoice = () => {
    setVoiceKey((key) => key + 1);
    setVoiceOpen(true);
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
  const totalPages = Math.max(1, Math.ceil(totalResultados / Math.max(1, perPage)));
  const pageLabel = {
    count: totalResultados,
    page: Math.min(page, totalPages),
    pages: totalPages,
  };
  const status = searching
    ? t("quick.loading")
    : visible.length > 0
      ? isFrequent
        ? t("quick.itemCount", { count: visible.length })
        : sinConexion
          ? t(
              totalResultados === 1
                ? "quick.offlinePageStatusOne"
                : "quick.offlinePageStatus",
              pageLabel,
            )
          : t(
              totalResultados === 1
                ? "quick.pageStatusOne"
                : "quick.pageStatus",
              pageLabel,
            )
      : sinCatalogo
        ? t("quick.offlineEmpty")
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
        <PendingBadge />

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
              icon="mic"
              label={t("voice.open")}
              onPress={openVoice}
              variant="tonal"
              size={44}
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

        {!isFrequent && !searching && visible.length > 0 && totalPages > 1 ? (
          <Paginator
            page={Math.min(page, totalPages)}
            pages={totalPages}
            onChange={(next) => {
              setPage(next);
              setBuscando(true);
            }}
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
        onSaved={(modo) => {
          if (modo === "offline") {
            showToast(t("sync.savedOffline"), "info");
            return;
          }

          showToast(t("cart.saved"), "success");
          void refreshFrequent();
        }}
        onDictate={() => {
          setCartOpen(false);
          // Let the cart sheet slide away before opening the voice sheet.
          setTimeout(openVoice, 250);
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

      <VoiceCartSheet
        key={`voice-${voiceKey}`}
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
      />
    </>
  );
}

/** Números de página visibles alrededor de la actual (máximo cinco). */
function pageNumbers(current: number, pages: number): number[] {
  const size = 5;
  const end = Math.min(pages, Math.max(current, current + Math.floor(size / 2)));
  const start = Math.max(1, Math.min(current - Math.floor(size / 2), end - size + 1));
  const numeros: number[] = [];

  for (let numero = start; numero <= end; numero += 1) {
    numeros.push(numero);
  }

  return numeros;
}

function Paginator({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 6,
        paddingVertical: 14,
      }}
    >
      <PageButton
        label="‹"
        accessibilityLabel={t("quick.previousPage")}
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      {pageNumbers(page, pages).map((numero) => {
        const active = numero === page;

        return (
          <Pressable
            key={numero}
            onPress={() => {
              if (!active) onChange(numero);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("quick.goToPage", { page: numero })}
            accessibilityState={{ selected: active }}
            style={{
              minWidth: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 8,
              backgroundColor: active ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
            }}
          >
            <Text
              style={{
                color: active ? colors.onAccent : colors.foreground,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              {String(numero)}
            </Text>
          </Pressable>
        );
      })}
      <PageButton
        label="›"
        accessibilityLabel={t("quick.nextPage")}
        disabled={page >= pages}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}

function PageButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={{
        minWidth: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontSize: 20,
          lineHeight: 22,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
