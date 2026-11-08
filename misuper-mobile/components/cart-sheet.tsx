/** The slide-up cart: edit quantities/prices and save the whole purchase. */

import { useState } from "react";
import {
  Column,
  Row,
  Shape,
  Surface,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button, IconButton } from "@/components/m3/buttons";
import { TextField } from "@/components/m3/inputs";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { apiFetch, apiFieldError, apiErrorMessage } from "@/lib/api";
import {
  clearCart,
  removeItem,
  updateItem,
  useCart,
  useCartTotal,
  type CartItem,
} from "@/lib/cart";
import { formatCurrency, formatQuantity, todayISO, unitLabel } from "@/lib/format";
import { cartKcal, itemKcal } from "@/lib/nutrition";
import { t } from "@/lib/i18n";
import { parseDecimal, roundMoney } from "@/lib/numbers";

export function CartSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cart = useCart();
  const total = useCartTotal();
  const nutrition = cartKcal(cart);
  const [fecha, setFecha] = useState(() => todayISO());
  const [comercio, setComercio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;

    const date = fecha.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) {
      setError(t("cart.invalidDate"));
      return;
    }

    if (cart.some((item) => item.cantidad <= 0 || item.precio_total < 0)) {
      setError(t("cart.invalidItem"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch<{ id: number }>("/api/compras", {
        method: "POST",
        body: {
          fecha: date,
          comercio: comercio.trim(),
          items: cart.map((item) =>
            item.producto_id !== null
              ? {
                  producto_id: item.producto_id,
                  unidad_base: item.unidad_base,
                  cantidad: item.cantidad,
                  precio_total: item.precio_total,
                }
              : {
                  nombre_libre: item.nombre,
                  unidad_base: item.unidad_base,
                  cantidad: item.cantidad,
                  precio_total: item.precio_total,
                },
          ),
        },
      });

      clearCart();
      onSaved();
      onClose();
    } catch (caught) {
      setError(apiFieldError(caught) ?? apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("cart.title")}
      footer={
        <>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth()]}
          >
            <M3Text variant="body" color="muted" modifiers={[weight(1)]}>
              {t("cart.total")}
            </M3Text>
            <M3Text variant="headline" weight="700">
              {formatCurrency(total)}
            </M3Text>
          </Row>
          <M3Text variant="caption" color="muted">
            {nutrition.withData > 0
              ? `≈ ${nutrition.total} kcal${
                  nutrition.withoutData > 0 ? ` · ${t("cart.kcalPartial")}` : ""
                }`
              : t("cart.noKcal")}
          </M3Text>
          <Button
            label={saving ? t("cart.saving") : t("cart.save")}
            icon="check"
            onPress={() => void save()}
            disabled={saving || cart.length === 0}
          />
          <Button
            label={t("cart.clear")}
            variant="text"
            onPress={clearCart}
            disabled={saving || cart.length === 0}
          />
          {error ? (
            <M3Text variant="caption" color="error">
              {error}
            </M3Text>
          ) : null}
        </>
      }
    >
      {cart.length === 0 ? (
        <M3Text
          variant="body"
          color="muted"
          modifiers={[padding(16, 8, 16, 16)]}
        >
          {t("cart.empty")}
        </M3Text>
      ) : (
        <>
          <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
            <TextField
              value={fecha}
              onChangeText={(value) => {
                setFecha(value);
                setError(null);
              }}
              label={t("cart.date")}
              placeholder="YYYY-MM-DD"
            />
            <TextField
              value={comercio}
              onChangeText={(value) => {
                setComercio(value);
                setError(null);
              }}
              label={t("cart.commerce")}
              placeholder={t("cart.commercePlaceholder")}
            />
          </Column>
          {cart.map((item, index) => (
            <CartLine
              key={item.uid}
              item={item}
              index={index}
              onChange={updateItem}
              onRemove={removeItem}
            />
          ))}
        </>
      )}
    </BottomSheet>
  );
}

function CartLine({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: CartItem;
  index: number;
  onChange: (
    index: number,
    patch: { cantidad?: number; precio_total?: number },
  ) => boolean;
  onRemove: (index: number) => boolean;
}) {
  const { colors } = useTheme();
  const [cantidad, setCantidad] = useState(() => formatQuantity(item.cantidad));
  const [precio, setPrecio] = useState(() => item.precio_total.toFixed(2));

  const changeQuantity = (value: string) => {
    setCantidad(value);
    const parsed = parseDecimal(value);
    if (parsed !== null && parsed > 0) onChange(index, { cantidad: parsed });
  };

  const changePrice = (value: string) => {
    setPrecio(value);
    const parsed = parseDecimal(value);
    if (parsed !== null && parsed >= 0) {
      onChange(index, { precio_total: parsed });
    }
  };

  return (
    <Row modifiers={[fillMaxWidth(), padding(10, 6, 10, 6)]}>
      <Surface
        color={colors.surface}
        contentColor={colors.foreground}
        shape={Shape.RoundedCorner({
          cornerRadii: {
            topStart: 16,
            topEnd: 16,
            bottomStart: 16,
            bottomEnd: 16,
          },
        })}
        border={{ width: 1, color: colors.accentContainer }}
        shadowElevation={1}
        modifiers={[fillMaxWidth(), padding(10, 10, 10, 10)]}
      >
        <Column verticalArrangement={{ spacedBy: 4 }}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Surface
              color={colors.accentContainer}
              contentColor={colors.onAccentContainer}
              shape={Shape.RoundedCorner({
                cornerRadii: {
                  topStart: 10,
                  topEnd: 10,
                  bottomStart: 10,
                  bottomEnd: 10,
                },
              })}
              modifiers={[padding(8, 8, 8, 8)]}
            >
              <SymbolIcon
                name="shopping-cart"
                size={20}
                tint={colors.accent}
                label={item.nombre}
              />
            </Surface>
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1), padding(8, 0, 4, 0)]}
            >
              <M3Text variant="body" weight="700" maxLines={2}>
                {item.nombre}
              </M3Text>
              <M3Text variant="caption" color="muted">
                {`${unitLabel(item.unidad_base)} · ${formatCurrency(
                  roundMoney(item.precio_total / item.cantidad),
                )}/${unitLabel(item.unidad_base)}`}
              </M3Text>
              {itemKcal(item) !== null ? (
                <M3Text variant="caption" color="muted">
                  {`≈ ${Math.round(itemKcal(item) ?? 0)} kcal`}
                </M3Text>
              ) : null}
            </Column>
            <IconButton
              icon="delete"
              label={t("cart.remove")}
              onPress={() => onRemove(index)}
              size={34}
              iconSize={18}
            />
          </Row>
          <Row
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth()]}
          >
            <TextField
              value={cantidad}
              onChangeText={changeQuantity}
              label={t("cart.quantity")}
              keyboardType="decimal"
              suffix={unitLabel(item.unidad_base)}
              modifiers={[weight(1)]}
            />
            <TextField
              value={precio}
              onChangeText={changePrice}
              label={t("cart.price")}
              keyboardType="decimal"
              prefix="$"
              modifiers={[weight(1)]}
            />
          </Row>
        </Column>
      </Surface>
    </Row>
  );
}
