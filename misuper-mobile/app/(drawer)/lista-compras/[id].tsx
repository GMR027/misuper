import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheet } from "@/components/bottom-sheet";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { UnitPicker } from "@/components/unit-picker";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { addFreeItem, addProduct } from "@/lib/cart";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface ListaResumen {
  id: number;
  nombre: string;
  items_count: number;
  pendientes: number;
}

interface ListaItem {
  id: number;
  lista_id: number;
  producto_id: number | null;
  nombre: string;
  cantidad: number;
  unidad_base: string;
  origen: string | null;
  estado: string;
  categoria_nombre: string | null;
  imagen_url: string | null;
}

interface CostoItem {
  id: number | null;
  nombre: string;
  costo: number | null;
  faltante: boolean;
  motivo: string | null;
}

interface ListaCosto {
  total: number;
  items_con_precio: number;
  items_sin_precio: number;
  precios_viejos: number;
  completo: boolean;
  items: CostoItem[];
}

interface ListaDetail {
  lista: ListaResumen;
  items: ListaItem[];
  costo: ListaCosto;
  total: number;
}

function parseNumber(value: string): number {
  return Number(value.trim().replace(",", "."));
}

export default function ShoppingListDetailScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const [data, setData] = useState<ListaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<ListaItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemUnit, setItemUnit] = useState("pza");
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<ListaDetail>(`/api/listas-compra/${id}`);
      setData(result);
      setListName(result.lista.nombre);
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
        const result = await apiFetch<ListaDetail>(`/api/listas-compra/${id}`);

        if (!alive) return;

        setData(result);
        setListName(result.lista.nombre);
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
    setItemUnit("pza");
    setItemError(null);
    setItemOpen(true);
  };

  const openEdit = (item: ListaItem) => {
    setEditing(item);
    setItemName(item.nombre);
    setItemQty(String(item.cantidad));
    setItemUnit(item.unidad_base);
    setItemError(null);
    setItemOpen(true);
  };

  const closeItem = () => {
    setItemOpen(false);
    setEditing(null);
    setItemError(null);
  };

  const saveItem = async () => {
    if (savingItem) return;

    const cantidad = parseNumber(itemQty);

    if (itemName.trim().length < 1 || itemName.trim().length > 150) {
      setItemError(t("shopping.nameInvalid"));
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setItemError(t("shopping.quantityInvalid"));
      return;
    }

    setSavingItem(true);
    setItemError(null);

    try {
      if (editing) {
        await apiFetch<unknown>(`/api/listas-compra/items/${editing.id}`, {
          method: "PUT",
          body: {
            nombre: itemName.trim(),
            cantidad,
            unidad_base: itemUnit,
          },
        });
      } else {
        await apiFetch<unknown>(`/api/listas-compra/${id}/items`, {
          method: "POST",
          body: {
            nombre: itemName.trim(),
            cantidad,
            unidad_base: itemUnit,
          },
        });
      }

      closeItem();
      await load();
      showToast(t("shopping.itemSaved"), "success");
    } catch (caught) {
      setItemError(apiErrorMessage(caught));
    } finally {
      setSavingItem(false);
    }
  };

  const removeItem = (item: ListaItem) => {
    Alert.alert(t("shopping.deleteItemTitle"), t("shopping.deleteItemBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("shopping.deleteItem"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<unknown>(`/api/listas-compra/items/${item.id}`, {
                method: "DELETE",
              });
              await load();
              showToast(t("shopping.itemDeleted"), "success");
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            }
          })();
        },
      },
    ]);
  };

  const rename = async () => {
    if (renaming) return;
    if (listName.trim().length === 0) {
      showToast(t("shopping.nameRequired"), "error");
      return;
    }

    setRenaming(true);
    try {
      await apiFetch<unknown>(`/api/listas-compra/${id}`, {
        method: "PUT",
        body: { nombre: listName.trim() },
      });
      setRenameOpen(false);
      await load();
      showToast(t("shopping.renamed"), "success");
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setRenaming(false);
    }
  };

  const clear = () => {
    Alert.alert(t("shopping.clearTitle"), t("shopping.clearBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("shopping.clear"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<unknown>(`/api/listas-compra/${id}/items`, {
                method: "DELETE",
              });
              await load();
              showToast(t("shopping.cleared"), "success");
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            }
          })();
        },
      },
    ]);
  };

  const deleteList = () => {
    Alert.alert(t("shopping.deleteTitle"), t("shopping.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("shopping.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<unknown>(`/api/listas-compra/${id}`, {
                method: "DELETE",
              });
              showToast(t("shopping.deleted"), "success");
              router.replace("/lista-compras");
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            }
          })();
        },
      },
    ]);
  };

  const sendToCart = async () => {
    if (sending) return;
    setSending(true);

    try {
      const sent = await apiFetch<{ enviados: number }>(
        `/api/listas-compra/${id}/enviar`,
        { method: "POST" },
      );

      if ((sent.enviados ?? 0) === 0) {
        showToast(t("shopping.nothingToSend"), "error");
        return;
      }

      const consumed = await apiFetch<{ items: ListaItem[] }>(
        "/api/lista-compras/consumir",
        { method: "POST" },
      );

      let added = 0;

      for (const item of consumed.items ?? []) {
        const ok =
          item.producto_id !== null
            ? addProduct(
                {
                  id: item.producto_id,
                  nombre: item.nombre,
                  unidad_base: item.unidad_base,
                  categoria_nombre: item.categoria_nombre,
                },
                { cantidad: item.cantidad },
              )
            : addFreeItem({
                nombre: item.nombre,
                unidad_base: item.unidad_base,
                cantidad: item.cantidad,
              });

        if (ok) added += 1;
      }

      await load();
      showToast(t("shopping.sentToCart", { count: added }), "success");
      if (added > 0) router.navigate("/");
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    } finally {
      setSending(false);
    }
  };

  const costById = new Map<number, number | null>();
  for (const item of data?.costo.items ?? []) {
    if (item.id !== null) costById.set(item.id, item.costo);
  }

  const pending = data?.items.filter((item) => item.estado === "pendiente").length ?? 0;

  return (
    <>
      <Screen title={t("shopping.detailTitle")}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <Spinner />
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}

        {data ? (
          <>
            <TextureCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors.foreground,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    {data.lista.nombre}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {t("shopping.itemsCount", { count: data.items.length })}
                    {pending > 0
                      ? ` · ${t("shopping.pendingCount", { count: pending })}`
                      : ""}
                  </Text>
                </View>
                <Pressable onPress={() => setRenameOpen(true)}>
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>
                    {t("shopping.rename")}
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                    {t("shopping.estimatedCost")}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 24,
                      fontWeight: "800",
                    }}
                  >
                    {formatCurrency(data.costo.total)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                    {t("shopping.withPrice", {
                      count: data.costo.items_con_precio,
                    })}
                  </Text>
                  {!data.costo.completo ? (
                    <Text style={{ color: colors.warning, fontSize: 10 }}>
                      {t("shopping.costPartial", {
                        count: data.costo.items_sin_precio,
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button
                  label={sending ? t("common.loading") : t("shopping.sendToCart")}
                  icon="shopping-cart"
                  onPress={() => void sendToCart()}
                  disabled={sending || pending === 0}
                />
                <Button
                  label={t("shopping.addItem")}
                  variant="outlined"
                  icon="add"
                  onPress={openAdd}
                />
                <Button
                  label={t("shopping.clear")}
                  variant="outlined"
                  icon="delete"
                  onPress={clear}
                  disabled={data.items.length === 0}
                />
              </View>
            </TextureCard>

            {data.items.length === 0 ? (
              <TextureCard>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    textAlign: "center",
                    paddingVertical: 12,
                  }}
                >
                  {t("shopping.emptyItems")}
                </Text>
              </TextureCard>
            ) : null}

            {data.items.map((item) => {
              const state =
                item.estado === "enviado"
                  ? t("shopping.sent")
                  : item.estado === "cargado"
                    ? t("shopping.loaded")
                    : t("shopping.pending");

              return (
                <TextureCard key={item.id}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.foreground,
                          fontSize: 13.5,
                          fontWeight: "700",
                        }}
                      >
                        {item.nombre}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 10.5 }}>
                        {`${formatQuantity(item.cantidad)} ${item.unidad_base}`}
                        {item.origen ? ` · ${item.origen}` : ""}
                      </Text>
                      <Text
                        style={{
                          color:
                            item.estado === "pendiente"
                              ? colors.accent
                              : colors.muted,
                          fontSize: 9.5,
                          fontWeight: "700",
                        }}
                      >
                        {state}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      {costById.get(item.id) != null ? (
                        <Text
                          style={{
                            color: colors.foreground,
                            fontSize: 11.5,
                            fontWeight: "700",
                          }}
                        >
                          {formatCurrency(costById.get(item.id) ?? 0)}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <Pressable
                          onPress={() => openEdit(item)}
                          hitSlop={6}
                        >
                          <Text
                            style={{
                              color: colors.accent,
                              fontSize: 10.5,
                              fontWeight: "700",
                            }}
                          >
                            {t("shopping.edit")}
                          </Text>
                        </Pressable>
                        <IconButton
                          icon="delete"
                          label={t("shopping.deleteItem")}
                          onPress={() => removeItem(item)}
                          size={28}
                          iconSize={16}
                          color={colors.error}
                        />
                      </View>
                    </View>
                  </View>
                </TextureCard>
              );
            })}

            <Button
              label={t("shopping.deleteList")}
              variant="outlined"
              icon="delete"
              onPress={deleteList}
            />
          </>
        ) : null}
      </Screen>

      {itemOpen ? (
        <BottomSheet
          visible
          onClose={closeItem}
          title={editing ? t("shopping.editItem") : t("shopping.addItem")}
          footer={
            <Button
              label={savingItem ? t("common.loading") : t("common.save")}
              icon="check"
              onPress={() => void saveItem()}
              disabled={savingItem}
            />
          }
        >
          <NativeContent>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <TextField
                value={itemName}
                onChangeText={setItemName}
                label={t("shopping.itemName")}
                placeholder={t("shopping.itemNamePlaceholder")}
              />
              <TextField
                value={itemQty}
                onChangeText={setItemQty}
                label={t("shopping.quantity")}
                keyboardType="decimal"
              />
              <View style={{ paddingVertical: 4 }}>
                <UnitPicker
                  value={itemUnit}
                  onChange={(unit) => setItemUnit(unit)}
                />
              </View>
              {itemError ? (
                <Text style={{ color: colors.error, fontSize: 12 }}>
                  {itemError}
                </Text>
              ) : null}
            </View>
          </NativeContent>
        </BottomSheet>
      ) : null}

      {renameOpen ? (
        <BottomSheet
          visible
          onClose={() => setRenameOpen(false)}
          title={t("shopping.rename")}
          footer={
            <Button
              label={renaming ? t("common.loading") : t("common.save")}
              icon="check"
              onPress={() => void rename()}
              disabled={renaming}
            />
          }
        >
          <NativeContent>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <TextField
                value={listName}
                onChangeText={setListName}
                label={t("shopping.name")}
              />
            </View>
          </NativeContent>
        </BottomSheet>
      ) : null}
    </>
  );
}
