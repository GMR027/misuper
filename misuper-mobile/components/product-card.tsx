/** Product cards with a real image, the web's 2:1 crop and a proper Add button. */

import { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, DotPattern } from "@/components/theme";
import { M3Host } from "@/components/m3/host";
import { SymbolIcon } from "@/components/m3/text";
import { formatCurrency, unitLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  productImage,
  productInitial,
  type Categoria,
  type Producto,
} from "@/lib/products";

function categoryName(product: Producto, categorias: Categoria[]): string {
  return (
    categorias.find((categoria) => categoria.id === product.categoria_id)?.nombre ??
    product.categoria_nombre ??
    t("quick.uncategorized")
  );
}

function Thumb({
  product,
  size,
}: {
  product: Producto;
  size: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = productImage(product);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size > 50 ? 12 : 10,
        overflow: "hidden",
        backgroundColor: colors.accentContainer,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`Imagen de ${product.nombre}`}
        />
      ) : (
        <Text
          style={{
            color: colors.accent,
            fontSize: size * 0.4,
            fontWeight: "800",
          }}
        >
          {productInitial(product)}
        </Text>
      )}
    </View>
  );
}

function CardImage({ product }: { product: Producto }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = productImage(product);

  return uri && !failed ? (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: 92 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel={`Imagen de ${product.nombre}`}
    />
  ) : (
    <View
      style={{
        width: "100%",
        height: 92,
        backgroundColor: colors.accentContainer,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: 38,
          fontWeight: "800",
        }}
      >
        {productInitial(product)}
      </Text>
    </View>
  );
}

/** A small rounded thumbnail for the dock search results. */
export function ProductThumb({
  product,
  size = 44,
}: {
  product: Producto;
  size?: number;
}) {
  return <Thumb product={product} size={size} />;
}

function AddButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("quick.add")}
      style={({ pressed }) => [
        {
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.accent,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          paddingHorizontal: 8,
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: colors.onAccent,
          fontSize: 18,
          fontWeight: "700",
          lineHeight: 18,
        }}
      >
        +
      </Text>
      <Text
        style={{
          color: colors.onAccent,
          fontSize: 12,
          fontWeight: "700",
        }}
        numberOfLines={1}
      >
        {t("quick.add")}
      </Text>
    </Pressable>
  );
}

function CalcButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("quick.calculate")}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <M3Host matchContents>
        <SymbolIcon
          name="calculate"
          size={18}
          tint={colors.accent}
          label={t("quick.calculate")}
        />
      </M3Host>
    </Pressable>
  );
}

export function ProductCard({
  product,
  categorias,
  onAdd,
  onCalc,
  list = false,
  style,
}: {
  product: Producto;
  categorias: Categoria[];
  onAdd: () => void;
  onCalc: () => void;
  list?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, scheme } = useTheme();
  const meta = `${categoryName(product, categorias)} · ${unitLabel(
    product.unidad_base,
  )}`;
  const price =
    product.ultimo_precio !== null &&
    product.ultimo_precio !== undefined &&
    product.ultimo_precio > 0
      ? `${formatCurrency(product.ultimo_precio)}/${unitLabel(product.unidad_base)}`
      : null;

  const card: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOpacity: scheme === "dark" ? 0.3 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    style,
  ];

  if (list) {
    return (
      <View style={[card, { flexDirection: "row", padding: 8, gap: 10 }]}>
        <DotPattern opacity={scheme === "dark" ? 0.06 : 0.03} />
        <Thumb product={product} size={72} />
        <View style={{ flex: 1, gap: 2, paddingVertical: 2 }}>
          <Text
            numberOfLines={2}
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {product.nombre}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
            {meta}
          </Text>
          {price ? (
            <Text numberOfLines={1} style={{ color: colors.accent, fontSize: 11 }}>
              {price}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <AddButton onPress={onAdd} style={{ flex: 1 }} />
            <CalcButton onPress={onCalc} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[card, { width: "48.5%" }]}>
      <DotPattern opacity={scheme === "dark" ? 0.06 : 0.03} />
      <View style={{ height: 92, backgroundColor: colors.accentContainer }}>
        <CardImage product={product} />
        <LinearGradient
          pointerEvents="none"
          colors={
            scheme === "dark"
              ? ["rgba(255,255,255,0.05)", "transparent"]
              : ["rgba(255,255,255,0.45)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 46,
          }}
        />
      </View>
      <View style={{ padding: 8, gap: 3 }}>
        <Text
          numberOfLines={2}
          style={{
            color: colors.foreground,
            fontSize: 12.5,
            fontWeight: "700",
            lineHeight: 15,
          }}
        >
          {product.nombre}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5 }}>
          {meta}
        </Text>
        {price ? (
          <Text numberOfLines={1} style={{ color: colors.accent, fontSize: 10.5 }}>
            {price}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            marginTop: 3,
          }}
        >
          <AddButton onPress={onAdd} style={{ flex: 1 }} />
          <CalcButton onPress={onCalc} />
        </View>
      </View>
    </View>
  );
}

/** Two cards per row, or full-width rows in list mode. */
export function ProductGrid({
  products,
  categorias,
  onAdd,
  onCalc,
  list = false,
}: {
  products: Producto[];
  categorias: Categoria[];
  onAdd: (product: Producto) => void;
  onCalc: (product: Producto) => void;
  list?: boolean;
}) {
  if (list) {
    return (
      <View style={{ gap: 8 }}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            categorias={categorias}
            onAdd={() => onAdd(product)}
            onCalc={() => onCalc(product)}
            list
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 8,
      }}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          categorias={categorias}
          onAdd={() => onAdd(product)}
          onCalc={() => onCalc(product)}
        />
      ))}
    </View>
  );
}
