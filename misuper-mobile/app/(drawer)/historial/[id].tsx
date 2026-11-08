import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";
import { BottomSheet } from "@/components/bottom-sheet";
import { ProductPickerSheet } from "@/components/product-picker-sheet";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { UnitPicker } from "@/components/unit-picker";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import type { Producto } from "@/lib/products";
import { t, useLocale } from "@/lib/i18n";
import { apiErrorMessage, apiFieldError, apiFetch } from "@/lib/api";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { showToast } from "@/lib/toast";

interface CompraItem {
  id: number;
  producto_id: number | null;
  nombre: string;
  unidad_base: string;
  comercio: string | null;
  cantidad: number;
  precio_total: number;
  kcal: number | null;
}

interface CompraDetail {
  id: number;
  fecha: string;
  total: number;
  comercio: string | null;
  ticket_id: number | null;
  ticket_titulo: string | null;
  items: CompraItem[];
  kcal_total: number;
  kcal_con_dato: number;
  kcal_sin_dato: number;
}

function parseNumber(value: string): number {
  return Number(value.trim().replace(",", "."));
}

export default function PurchaseDetailScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const [compra, setCompra] = useState<CompraDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [comercio, setComercio] = useState("");
  const [savingData, setSavingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CompraItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("0.00");
  const [itemUnit, setItemUnit] = useState("pza");
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ticketPhoto, setTicketPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CompraDetail>(`/api/compras/${id}`);
      setCompra(data);
      setFecha(data.fecha);
      setComercio(data.comercio ?? "");
      setError(null);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<CompraDetail>(`/api/compras/${id}`);

        if (!alive) return;

        setCompra(data);
        setFecha(data.fecha);
        setComercio(data.comercio ?? "");
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const openAdd = () => {
    setEditing(null);
    setItemName("");
    setItemQty("1");
    setItemPrice("0.00");
    setItemUnit("pza");
    setItemError(null);
    setEditorOpen(true);
  };

  const openEdit = (item: CompraItem) => {
    setEditing(item);
    setItemName(item.nombre);
    setItemQty(String(item.cantidad));
    setItemPrice(item.precio_total.toFixed(2));
    setItemUnit(item.unidad_base);
    setItemError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setItemError(null);
  };

  const saveData = async () => {
    if (savingData) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
      setDataError(t("history.dateInvalid"));
      return;
    }

    setSavingData(true);
    setDataError(null);

    try {
      await apiFetch<unknown>(`/api/compras/${id}`, {
        method: "PUT",
        body: { fecha: fecha.trim(), comercio: comercio.trim() },
      });
      await load();
      showToast(t("history.saved"), "success");
    } catch (caught) {
      setDataError(apiFieldError(caught) ?? apiErrorMessage(caught));
    } finally {
      setSavingData(false);
    }
  };

  const saveItem = async () => {
    if (savingItem) return;

    const cantidad = parseNumber(itemQty);
    const precio = parseNumber(itemPrice);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setItemError(t("history.quantityInvalid"));
      return;
    }

    if (!Number.isFinite(precio) || precio < 0) {
      setItemError(t("history.priceInvalid"));
      return;
    }

    if (editing === null && (itemName.trim().length < 2 || itemName.trim().length > 150)) {
      setItemError(t("history.nameInvalid"));
      return;
    }

    setSavingItem(true);
    setItemError(null);

    try {
      if (editing) {
        await apiFetch<unknown>(`/api/compras/${id}/items/${editing.id}`, {
          method: "PUT",
          body: {
            cantidad,
            precio_total: precio,
            unidad_base: itemUnit,
          },
        });
      } else {
        await apiFetch<unknown>(`/api/compras/${id}/items`, {
          method: "POST",
          body: selectedProduct
            ? {
                producto_id: selectedProduct.id,
                unidad_base: itemUnit,
                cantidad,
                precio_total: precio,
              }
            : {
                nombre_libre: itemName.trim(),
                unidad_base: itemUnit,
                cantidad,
                precio_total: precio,
              },
        });
      }

      closeEditor();
      await load();
      showToast(t("history.itemSaved"), "success");
    } catch (caught) {
      setItemError(apiFieldError(caught) ?? apiErrorMessage(caught));
    } finally {
      setSavingItem(false);
    }
  };

  const openTicketPhoto = async () => {
    if (!compra?.ticket_id || photoLoading) return;

    setPhotoLoading(true);

    try {
      const data = await apiFetch<{ data_url: string }>(
        `/api/tickets/${compra.ticket_id}/foto`,
      );
      setTicketPhoto(data.data_url);
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setPhotoLoading(false);
    }
  };

  const removeItem = (item: CompraItem) => {
    Alert.alert(t("history.deleteItemTitle"), t("history.deleteItemBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("history.deleteItem"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<{ deleted: boolean }>(
                `/api/compras/${id}/items/${item.id}`,
                { method: "DELETE" },
              );
              await load();
              showToast(t("history.itemDeleted"), "success");
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            }
          })();
        },
      },
    ]);
  };

  const removePurchase = () => {
    Alert.alert(
      t("history.deletePurchaseTitle"),
      t("history.deletePurchaseBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("history.deletePurchase"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await apiFetch<{ deleted: boolean }>(`/api/compras/${id}`, {
                  method: "DELETE",
                });
                showToast(t("history.purchaseDeleted"), "success");
                router.replace("/historial");
              } catch (caught) {
                showToast(apiErrorMessage(caught), "error");
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <>
      <Screen title={t("history.detailTitle")}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Spinner />
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}

        {compra ? (
          <>
            <TextureCard>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {t("history.total")}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 30,
                  fontWeight: "800",
                }}
              >
                {formatCurrency(compra.total)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {`${compra.fecha} · ${t("history.itemsCount", {
                  count: compra.items.length,
                })}`}
              </Text>
              {compra.ticket_titulo ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {t("history.fromTicket", { title: compra.ticket_titulo })}
                </Text>
              ) : null}
              {compra.ticket_id ? (
                <Button
                  label={
                    photoLoading ? t("common.loading") : t("history.viewTicket")
                  }
                  variant="outlined"
                  icon="receipt-long"
                  onPress={() => void openTicketPhoto()}
                  disabled={photoLoading}
                />
              ) : null}
              {compra.kcal_total > 0 ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {`${Math.round(compra.kcal_total)} kcal`}
                </Text>
              ) : null}
            </TextureCard>

            <TextureCard>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {t("history.purchaseData")}
              </Text>
              <TextField
                value={fecha}
                onChangeText={setFecha}
                label={t("history.date")}
                placeholder="2026-11-08"
              />
              <TextField
                value={comercio}
                onChangeText={setComercio}
                label={t("history.commerce")}
                placeholder={t("history.commercePlaceholder")}
              />
              {dataError ? (
                <Text style={{ color: colors.error, fontSize: 12 }}>
                  {dataError}
                </Text>
              ) : null}
              <Button
                label={savingData ? t("common.loading") : t("history.saveData")}
                icon="check"
                onPress={() => void saveData()}
                disabled={savingData}
              />
            </TextureCard>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {t("history.items")}
              </Text>
              <Button
                label={t("history.addItem")}
                variant="outlined"
                icon="add"
                onPress={openAdd}
              />
            </View>

            {compra.items.length === 0 ? (
              <TextureCard>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    textAlign: "center",
                    paddingVertical: 10,
                  }}
                >
                  {t("history.noItems")}
                </Text>
              </TextureCard>
            ) : null}

            {compra.items.map((item) => (
              <TextureCard key={item.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {item.nombre}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {`${formatQuantity(item.cantidad)} ${item.unidad_base} · ${formatCurrency(item.precio_total)}`}
                    </Text>
                    {item.kcal !== null ? (
                      <Text style={{ color: colors.muted, fontSize: 10 }}>
                        {`${Math.round(item.kcal)} kcal`}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => openEdit(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("history.editItem")}
                  >
                    <Text
                      style={{
                        color: colors.accent,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {t("history.editItem")}
                    </Text>
                  </Pressable>
                  <IconButton
                    icon="delete"
                    label={t("history.deleteItem")}
                    onPress={() => removeItem(item)}
                    size={32}
                    iconSize={18}
                    color={colors.error}
                  />
                </View>
              </TextureCard>
            ))}

            <Button
              label={t("history.deletePurchase")}
              variant="outlined"
              icon="delete"
              onPress={removePurchase}
            />
          </>
        ) : null}
      </Screen>

      <BottomSheet
        visible={editorOpen}
        onClose={closeEditor}
        title={editing ? t("history.editItem") : t("history.addItem")}
        footer={
          <Button
            label={savingItem ? t("common.loading") : t("common.save")}
            icon="check"
            onPress={() => void saveItem()}
            disabled={savingItem}
          />
        }
      >
        {editing === null ? (
          <>
          <TextField
            value={itemName}
            onChangeText={(value) => {
              setItemName(value);
              setItemError(null);
            }}
            label={t("history.itemName")}
            placeholder={t("history.itemNamePlaceholder")}
            modifiers={[fillMaxWidth(), padding(16, 2, 16, 2)]}
          />
          <Button
            label={
              selectedProduct
                ? t("history.changeProduct")
                : t("history.pickProduct")
            }
            variant="outlined"
            icon="search"
            onPress={() => {
              setEditorOpen(false);
              setPickerOpen(true);
            }}
          />
          {selectedProduct ? (
            <M3Text
              variant="caption"
              color="accent"
              modifiers={[padding(16, 0, 16, 0)]}
            >
              {selectedProduct.nombre}
            </M3Text>
          ) : null}
          </>
        ) : null}
        <TextField
          value={itemQty}
          onChangeText={(value) => {
            setItemQty(value);
            setItemError(null);
          }}
          label={t("history.quantity")}
          keyboardType="decimal"
          modifiers={[fillMaxWidth(), padding(16, 2, 16, 2)]}
        />
        <TextField
          value={itemPrice}
          onChangeText={(value) => {
            setItemPrice(value);
            setItemError(null);
          }}
          label={t("history.price")}
          keyboardType="decimal"
          prefix="$"
          modifiers={[fillMaxWidth(), padding(16, 2, 16, 2)]}
        />
        <NativeContent wrap>
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <UnitPicker
              value={itemUnit}
              onChange={(unit) => setItemUnit(unit)}
            />
          </View>
        </NativeContent>
        {itemError ? (
          <Text
            style={{
              color: colors.error,
              fontSize: 12,
              paddingHorizontal: 16,
            }}
          >
            {itemError}
          </Text>
        ) : null}
      </BottomSheet>

      <Modal
        visible={ticketPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTicketPhoto(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.94)",
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={() => setTicketPhoto(null)}
            style={{
              position: "absolute",
              top: insets.top + 10,
              right: 16,
              zIndex: 2,
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: 28,
                fontWeight: "700",
                lineHeight: 30,
              }}
            >
              ×
            </Text>
          </Pressable>
          {ticketPhoto ? (
            <Image
              source={{ uri: ticketPhoto }}
              style={{ width: "100%", height: "86%" }}
              resizeMode="contain"
            />
          ) : (
            <Spinner />
          )}
        </View>
      </Modal>

      {pickerOpen ? (
        <ProductPickerSheet
          visible
          onSelect={(product: Producto) => {
            setSelectedProduct(product);
            setItemName(product.nombre);
            setItemUnit(product.unidad_base);
            setPickerOpen(false);
            setEditorOpen(true);
          }}
          onClose={() => {
            setPickerOpen(false);
            setEditorOpen(true);
          }}
        />
      ) : null}
    </>
  );
}
