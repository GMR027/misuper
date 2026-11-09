import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ProductPickerSheet } from "@/components/product-picker-sheet";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { UnitPicker } from "@/components/unit-picker";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { TextField } from "@/components/m3/inputs";
import { t, useLocale } from "@/lib/i18n";
import { apiErrorMessage, apiFieldError, apiFetch, apiUpload } from "@/lib/api";
import { formatCurrency, formatQuantity } from "@/lib/format";
import type { Producto } from "@/lib/products";
import { useResponsive } from "@/lib/responsive";
import { showToast } from "@/lib/toast";

interface TicketItemProposal {
  nombre: string;
  cantidad: number;
  precio_total: number;
  producto_id: number | null;
  producto_nombre: string | null;
  unidad_base: string;
}

interface TicketProposal {
  ticket: {
    id: number;
    titulo: string;
    estado: string;
    total_detectado: number | null;
  };
  titulo: string;
  fecha: string;
  total_detectado: number | null;
  total_suma: number;
  items: TicketItemProposal[];
  texto: string;
}

interface DraftItem {
  key: string;
  nombre: string;
  cantidad: string;
  precio: string;
  unidad: string;
  productoId: number | null;
  originalName: string | null;
}

function parseNumber(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function draftFromProposal(item: TicketItemProposal, index: number): DraftItem {
  return {
    key: `item-${index}-${item.nombre}`,
    nombre: item.producto_nombre ?? item.nombre,
    cantidad: String(item.cantidad),
    precio: item.precio_total.toFixed(2),
    unidad: item.unidad_base,
    productoId: item.producto_id,
    originalName: item.producto_nombre ?? item.nombre,
  };
}

export default function TicketsScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const { contentWidth } = useResponsive();
  const ticketColumns = contentWidth >= 980 ? 3 : contentWidth >= 620 ? 2 : 1;
  const [reading, setReading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [comercio, setComercio] = useState("");
  const [totalDetectado, setTotalDetectado] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [showOcr, setShowOcr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [itemSeq, setItemSeq] = useState(0);
  const [remapKey, setRemapKey] = useState<string | null>(null);

  const reviewing = ticketId !== null;

  const reset = () => {
    setPhoto(null);
    setTicketId(null);
    setTitulo("");
    setFecha("");
    setComercio("");
    setTotalDetectado(null);
    setDraft([]);
    setOcrText("");
    setShowOcr(false);
    setReviewError(null);
    setUploadError(null);
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setReading(true);
    setUploadError(null);

    try {
      if (ticketId !== null) {
        await apiFetch<{ deleted: boolean }>(`/api/tickets/${ticketId}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }

      const form = new FormData();
      form.append(
        "foto",
        {
          uri: asset.uri,
          name: asset.fileName ?? "ticket.jpg",
          type: asset.mimeType ?? "image/jpeg",
        } as unknown as Blob,
      );

      const data = await apiUpload<TicketProposal>("/api/tickets", form);

      setPhoto(asset.uri);
      setTicketId(data.ticket.id);
      setTitulo(data.titulo);
      setFecha(data.fecha);
      setComercio("");
      setTotalDetectado(data.total_detectado);
      setDraft(data.items.map(draftFromProposal));
      setOcrText(data.texto ?? "");
      showToast(t("tickets.readDone"), "success");
    } catch (caught) {
      setUploadError(apiErrorMessage(caught));
    } finally {
      setReading(false);
    }
  };

  const pickPhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showToast(
        fromCamera ? t("tickets.cameraPermission") : t("tickets.galleryPermission"),
        "error",
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      await uploadAsset(result.assets[0]);
    }
  };

  const addItem = () => {
    setItemSeq((value) => value + 1);
    setDraft((current) => [
      ...current,
      {
        key: `new-${itemSeq + 1}`,
        nombre: "",
        cantidad: "1",
        precio: "0.00",
        unidad: "pza",
        productoId: null,
        originalName: null,
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setDraft((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
    setReviewError(null);
  };

  const removeItem = (key: string) => {
    setDraft((current) => current.filter((item) => item.key !== key));
  };

  const sum = draft.reduce((total, item) => {
    const price = parseNumber(item.precio);
    return total + (Number.isFinite(price) ? price : 0);
  }, 0);

  const discard = () => {
    Alert.alert(t("tickets.discardTitle"), t("tickets.discardBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("tickets.discard"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (ticketId !== null) {
              try {
                await apiFetch<{ deleted: boolean }>(`/api/tickets/${ticketId}`, {
                  method: "DELETE",
                });
              } catch {
                // The ticket may already be gone; the screen resets anyway.
              }
            }
            reset();
          })();
        },
      },
    ]);
  };

  const confirm = async () => {
    if (saving || ticketId === null) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
      setReviewError(t("tickets.dateInvalid"));
      return;
    }

    if (draft.length === 0) {
      setReviewError(t("tickets.itemsRequired"));
      return;
    }

    const items = [];

    for (const item of draft) {
      const cantidad = parseNumber(item.cantidad);
      const precio = parseNumber(item.precio);
      const nombre = item.nombre.trim();

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setReviewError(t("tickets.quantityInvalid"));
        return;
      }

      if (!Number.isFinite(precio) || precio < 0) {
        setReviewError(t("tickets.priceInvalid"));
        return;
      }

      if (
        item.productoId !== null &&
        item.originalName !== null &&
        nombre === item.originalName
      ) {
        items.push({
          producto_id: item.productoId,
          unidad_base: item.unidad,
          cantidad,
          precio_total: precio,
        });
      } else {
        if (nombre.length < 2 || nombre.length > 150) {
          setReviewError(t("tickets.nameInvalid"));
          return;
        }

        items.push({
          nombre_libre: nombre,
          unidad_base: item.unidad,
          cantidad,
          precio_total: precio,
        });
      }
    }

    setSaving(true);
    setReviewError(null);

    try {
      const compra = await apiFetch<{ id: number }>(
        `/api/tickets/${ticketId}/confirm`,
        {
          method: "POST",
          body: {
            fecha: fecha.trim(),
            titulo: titulo.trim(),
            comercio: comercio.trim(),
            items,
          },
        },
      );

      showToast(t("tickets.saved"), "success");
      reset();
      router.push(`/historial/${compra.id}`);
    } catch (caught) {
      setReviewError(apiFieldError(caught) ?? apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const mismatch =
    totalDetectado !== null && Math.abs(totalDetectado - sum) > 0.01;

  return (
    <>
      <Screen
        title={t("tickets.title")}
        footer={
          reviewing ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 8,
              }}
            >
              {reviewError ? (
                <Text style={{ color: colors.error, fontSize: 12 }}>
                  {reviewError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button
                  label={saving ? t("tickets.confirming") : t("tickets.confirm")}
                  icon="check"
                  onPress={() => void confirm()}
                  disabled={saving}
                />
                <Button
                  label={t("tickets.discard")}
                  variant="outlined"
                  icon="delete"
                  onPress={discard}
                  disabled={saving}
                />
              </View>
            </View>
          ) : undefined
        }
      >
      {!reviewing ? (
        <TextureCard>
          <Text
            style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}
          >
            {t("tickets.uploadTitle")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {t("tickets.uploadHint")}
          </Text>

          {reading ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 6,
              }}
            >
              <Spinner />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {t("tickets.reading")}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {t("tickets.readingHint")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                label={t("tickets.camera")}
                icon="add"
                onPress={() => void pickPhoto(true)}
              />
              <Button
                label={t("tickets.gallery")}
                variant="outlined"
                icon="upload-file"
                onPress={() => void pickPhoto(false)}
              />
            </View>
          )}

          {uploadError ? (
            <Text style={{ color: colors.error, fontSize: 12 }}>
              {uploadError}
            </Text>
          ) : null}

          <Pressable onPress={() => router.push("/historial")}>
            <Text
              style={{
                color: colors.accent,
                fontSize: 12,
                fontWeight: "600",
                paddingTop: 2,
              }}
            >
              {t("tickets.openHistory")}
            </Text>
          </Pressable>
        </TextureCard>
      ) : (
        <>
          <TextureCard>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{ width: 64, height: 84, borderRadius: 8 }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  {t("tickets.reviewTitle")}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {t("tickets.reviewHint")}
                </Text>
              </View>
            </View>

            <TextField
              value={titulo}
              onChangeText={setTitulo}
              label={t("tickets.name")}
              placeholder={t("tickets.namePlaceholder")}
            />
            <TextField
              value={fecha}
              onChangeText={setFecha}
              label={t("tickets.date")}
              placeholder="2026-11-08"
            />
            <TextField
              value={comercio}
              onChangeText={setComercio}
              label={t("tickets.commerce")}
              placeholder={t("tickets.commercePlaceholder")}
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
              {t("tickets.items")}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {t("tickets.itemsSum")} {formatCurrency(sum)}
            </Text>
          </View>

          {draft.length === 0 ? (
            <TextureCard>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  textAlign: "center",
                  paddingVertical: 10,
                }}
              >
                {t("tickets.noItems")}
              </Text>
            </TextureCard>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            {draft.map((item) => (
              <TextureCard
                key={item.key}
                style={{
                  width:
                    ticketColumns === 1
                      ? "100%"
                      : ticketColumns === 2
                        ? "49%"
                        : "32.5%",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {item.nombre.trim() === ""
                      ? t("tickets.newItem")
                      : item.nombre}
                  </Text>
                  {item.productoId !== null ? (
                    <View
                      style={{
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        backgroundColor: colors.accentContainer,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.onAccentContainer,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {t("tickets.catalog")}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setRemapKey(item.key)}
                    hitSlop={6}
                  >
                    <Text
                      style={{
                        color: colors.accent,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {t("tickets.pickProduct")}
                    </Text>
                  </Pressable>
                  <IconButton
                    icon="delete"
                    label={t("tickets.removeItem")}
                    onPress={() => removeItem(item.key)}
                    size={32}
                    iconSize={18}
                    color={colors.error}
                  />
                </View>

                <TextField
                  value={item.nombre}
                  onChangeText={(value) => updateItem(item.key, { nombre: value })}
                  label={t("tickets.itemName")}
                  placeholder={t("tickets.itemNamePlaceholder")}
                />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={item.cantidad}
                      onChangeText={(value) =>
                        updateItem(item.key, { cantidad: value })
                      }
                      label={t("tickets.quantity")}
                      keyboardType="decimal"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={item.precio}
                      onChangeText={(value) =>
                        updateItem(item.key, { precio: value })
                      }
                      label={t("tickets.price")}
                      keyboardType="decimal"
                      prefix="$"
                    />
                  </View>
                </View>

                <UnitPicker
                  value={item.unidad}
                  onChange={(unit) => updateItem(item.key, { unidad: unit })}
                />

                <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                  {`${formatQuantity(parseNumber(item.cantidad) || 0)} ${item.unidad}`}
                </Text>
              </TextureCard>
            ))}
          </View>

          <Button
            label={t("tickets.addItem")}
            variant="outlined"
            icon="add"
            onPress={addItem}
          />

          <TextureCard>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {t("tickets.detectedTotal")}
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  {totalDetectado === null
                    ? t("tickets.notDetected")
                    : formatCurrency(totalDetectado)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {t("tickets.itemsSum")}
                </Text>
                <Text
                  style={{
                    color: mismatch ? colors.warning : colors.foreground,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  {formatCurrency(sum)}
                </Text>
              </View>
            </View>
            {mismatch ? (
              <Text style={{ color: colors.warning, fontSize: 11, lineHeight: 16 }}>
                {t("tickets.totalMismatch", {
                  total: formatCurrency(totalDetectado ?? 0),
                  sum: formatCurrency(sum),
                })}
              </Text>
            ) : null}
          </TextureCard>

          {ocrText.trim() !== "" ? (
            <TextureCard>
              <Pressable onPress={() => setShowOcr((value) => !value)}>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {showOcr ? t("tickets.hideOcr") : t("tickets.showOcr")}
                </Text>
              </Pressable>
              {showOcr ? (
                <Text
                  selectable
                  style={{
                    color: colors.muted,
                    fontSize: 11.5,
                    lineHeight: 16,
                    fontFamily: "monospace",
                  }}
                >
                  {ocrText}
                </Text>
              ) : null}
            </TextureCard>
          ) : null}
        </>
      )}
      </Screen>

      {remapKey !== null ? (
        <ProductPickerSheet
          visible
          onClose={() => setRemapKey(null)}
          onSelect={(product: Producto) => {
            const key = remapKey;
            if (key === null) return;
            updateItem(key, {
              nombre: product.nombre,
              unidad: product.unidad_base,
              productoId: product.id,
              originalName: product.nombre,
            });
            setRemapKey(null);
          }}
        />
      ) : null}
    </>
  );
}
