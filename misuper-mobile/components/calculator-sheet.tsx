/** Cost per unit × quantity, the web's "Calcular compra" calculator. */

import { useState } from "react";
import { Row, Surface, Shape } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import { addProduct } from "@/lib/cart";
import { formatCurrency, formatQuantity, unitLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import { parseDecimal, roundMoney } from "@/lib/numbers";
import { readUnitPrice, saveUnitPrice } from "@/lib/prices";
import type { Producto } from "@/lib/products";

export function CalculatorSheet({
  visible,
  product,
  onClose,
  onAdded,
}: {
  visible: boolean;
  product: Producto | null;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const { colors } = useTheme();
  const [priceText, setPriceText] = useState(() => {
    if (!product) return "";
    if (product.ultimo_precio && product.ultimo_precio > 0) {
      return String(roundMoney(product.ultimo_precio));
    }
    const saved = readUnitPrice(product.id);
    return saved === null ? "" : String(saved);
  });
  const [quantityText, setQuantityText] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const price = parseDecimal(priceText);
  const quantity = parseDecimal(quantityText);
  const total =
    price !== null &&
    price >= 0 &&
    quantity !== null &&
    quantity > 0
      ? roundMoney(price * quantity)
      : null;

  const hint =
    product?.ultimo_precio && product.ultimo_precio > 0
      ? t("calculator.suggested", {
          price: formatCurrency(product.ultimo_precio),
          unit: unitLabel(product.unidad_base),
        })
      : t("calculator.noPrice");

  const submit = () => {
    if (!product) return;

    if (price === null || price < 0) {
      setError(t("calculator.invalidPrice"));
      return;
    }

    if (quantity === null || quantity <= 0) {
      setError(t("calculator.invalidQuantity"));
      return;
    }

    const importe = roundMoney(price * quantity);

    if (!addProduct(product, { cantidad: quantity, precio_total: importe })) {
      setError(t("cart.max"));
      return;
    }

    saveUnitPrice(product.id, price);
    onAdded?.();
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("calculator.title")}
      footer={
        <Button
          label={t("calculator.add")}
          icon="add"
          onPress={submit}
        />
      }
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}
      >
        <M3Text variant="subtitle" modifiers={[weight(1)]} maxLines={2}>
          {product?.nombre ?? ""}
        </M3Text>
        <M3Text variant="caption" color="muted">
          {product ? unitLabel(product.unidad_base) : ""}
        </M3Text>
      </Row>

      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), padding(16, 0, 16, 4)]}
      >
        <TextField
          value={priceText}
          onChangeText={(value) => {
            setPriceText(value);
            setError(null);
          }}
          label={t("calculator.unitCost")}
          placeholder="0.00"
          keyboardType="decimal"
          modifiers={[weight(1)]}
        />
        <TextField
          value={quantityText}
          onChangeText={(value) => {
            setQuantityText(value);
            setError(null);
          }}
          label={t("calculator.quantity")}
          keyboardType="decimal"
          modifiers={[weight(1)]}
        />
      </Row>

      <Row modifiers={[fillMaxWidth(), padding(16, 8, 16, 4)]}>
        <Surface
          color={colors.accentContainer}
          contentColor={colors.onAccentContainer}
          shape={Shape.RoundedCorner({
            cornerRadii: {
              topStart: 14,
              topEnd: 14,
              bottomStart: 14,
              bottomEnd: 14,
            },
          })}
          modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}
        >
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <M3Text
              variant="caption"
              weight="700"
              color={colors.onAccentContainer}
              modifiers={[weight(1)]}
            >
              {t("calculator.total")}
            </M3Text>
            <M3Text
              variant="headline"
              weight="700"
              color={colors.onAccentContainer}
            >
              {total === null ? "—" : formatCurrency(total)}
            </M3Text>
          </Row>
        </Surface>
      </Row>

      <M3Text
        variant="caption"
        color="muted"
        modifiers={[padding(16, 0, 16, 4)]}
      >
        {hint}
      </M3Text>

      {price !== null && quantity !== null && quantity > 0 ? (
        <M3Text
          variant="caption"
          color="muted"
          modifiers={[padding(16, 0, 16, 8)]}
        >
          {`${formatCurrency(price)} × ${formatQuantity(quantity)} ${unitLabel(
            product?.unidad_base ?? "pza",
          )} = ${formatCurrency(roundMoney(price * quantity))}`}
        </M3Text>
      ) : null}

      {error ? (
        <M3Text
          variant="caption"
          color="error"
          modifiers={[padding(16, 0, 16, 8)]}
        >
          {error}
        </M3Text>
      ) : null}
    </BottomSheet>
  );
}
