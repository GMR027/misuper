/** "Nuevo producto", the web's form: create a personal product and add it. */

import { useState } from "react";
import { Row } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding, weight } from "@expo/ui/jetpack-compose/modifiers";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { ChipGrid, ChipRow, type ChipOption } from "@/components/m3/chips";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import { apiFetch, apiFieldError, apiErrorMessage } from "@/lib/api";
import { addProduct, type CartUnit } from "@/lib/cart";
import { t } from "@/lib/i18n";
import { parseDecimal, roundMoney } from "@/lib/numbers";
import type { Categoria, Producto } from "@/lib/products";

const UNITS: ChipOption<CartUnit>[] = [
  { value: "kg", label: "kg" },
  { value: "gr", label: "gr" },
  { value: "L", label: "L" },
  { value: "ml", label: "ml" },
  { value: "pza", label: "pza" },
];

export function NewProductSheet({
  visible,
  categorias,
  onClose,
  onAdded,
}: {
  visible: boolean;
  categorias: Categoria[];
  onClose: () => void;
  onAdded?: (product: Producto) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(
    () => categorias[0]?.id ?? null,
  );
  const [unidad, setUnidad] = useState<CartUnit>("pza");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;

    const name = nombre.trim();
    const quantity = parseDecimal(cantidad);
    const price = parseDecimal(precio);

    if (name === "") {
      setError(t("productForm.nameRequired"));
      return;
    }

    if (categoriaId === null) {
      setError(t("productForm.categoryRequired"));
      return;
    }

    if (quantity === null || quantity <= 0) {
      setError(t("productForm.quantityInvalid"));
      return;
    }

    if (price === null || price < 0) {
      setError(t("productForm.priceInvalid"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const producto = await apiFetch<Producto>("/api/productos", {
        method: "POST",
        body: {
          nombre: name,
          categoria_id: categoriaId,
          unidad_base: unidad,
        },
      });

      if (
        !addProduct(producto, {
          cantidad: quantity,
          precio_total: roundMoney(price),
        })
      ) {
        setError(t("cart.max"));
        return;
      }

      onAdded?.(producto);
      onClose();
    } catch (caught) {
      setError(apiFieldError(caught) ?? apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const categoryOptions: ChipOption<number>[] = categorias.map((categoria) => ({
    value: categoria.id,
    label: categoria.nombre,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("productForm.productTitle")}
      footer={
        <Button
          label={busy ? t("productForm.saving") : t("productForm.save")}
          icon="add"
          onPress={() => void save()}
          disabled={busy}
        />
      }
    >
      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), padding(16, 0, 16, 4)]}
      >
        <TextField
          value={nombre}
          onChangeText={(value) => {
            setNombre(value);
            setError(null);
          }}
          label={t("productForm.name")}
          placeholder={t("productForm.namePlaceholder")}
        />
      </Row>

      <M3Text
        variant="caption"
        color="muted"
        modifiers={[padding(16, 4, 16, 2)]}
      >
        {t("productForm.category")}
      </M3Text>
      <Row modifiers={[fillMaxWidth(), padding(16, 0, 16, 6)]}>
        <ChipGrid
          options={categoryOptions}
          value={categoriaId}
          onChange={setCategoriaId}
        />
      </Row>

      <M3Text
        variant="caption"
        color="muted"
        modifiers={[padding(16, 4, 16, 2)]}
      >
        {t("productForm.unit")}
      </M3Text>
      <Row modifiers={[fillMaxWidth(), padding(16, 0, 16, 6)]}>
        <ChipRow options={UNITS} value={unidad} onChange={setUnidad} />
      </Row>

      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
      >
        <TextField
          value={cantidad}
          onChangeText={(value) => {
            setCantidad(value);
            setError(null);
          }}
          label={t("productForm.quantity")}
          keyboardType="decimal"
          modifiers={[weight(1)]}
        />
        <TextField
          value={precio}
          onChangeText={(value) => {
            setPrecio(value);
            setError(null);
          }}
          label={t("productForm.price")}
          keyboardType="decimal"
          prefix="$"
          modifiers={[weight(1)]}
        />
      </Row>

      {error ? (
        <M3Text
          variant="caption"
          color="error"
          modifiers={[padding(16, 4, 16, 8)]}
        >
          {error}
        </M3Text>
      ) : null}
    </BottomSheet>
  );
}
