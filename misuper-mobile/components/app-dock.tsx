/** The web's five-slot bottom dock, with the central search FAB. */

import { useState } from "react";
import { View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Column, Row, Shape, Spacer, Surface } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  size,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { DotPattern, useTheme } from "@/components/theme";
import { CalculatorSheet } from "@/components/calculator-sheet";
import { DockSearchSheet } from "@/components/dock-search-sheet";
import { MenuSheet } from "@/components/menu-sheet";
import { M3Host } from "@/components/m3/host";
import { IconButton } from "@/components/m3/buttons";
import { SymbolIcon, type SymbolName } from "@/components/m3/text";
import { DOCK_HEIGHT } from "@/lib/layout";
import type { Producto } from "@/lib/products";
import { showToast } from "@/lib/toast";
import { closeMenu, openMenu, useMenuOpen } from "@/lib/ui-store";
import { t } from "@/lib/i18n";

type DockRoute = "/" | "/notas" | "/tickets";

export function AppDock() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const menuOpen = useMenuOpen();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [calcProduct, setCalcProduct] = useState<Producto | null>(null);
  const [calcKey, setCalcKey] = useState(0);

  const openSearch = () => {
    setSearchKey((key) => key + 1);
    setSearchOpen(true);
  };

  const go = (path: DockRoute) => {
    router.navigate(path);
  };

  const openCalc = (product: Producto) => {
    setCalcKey((key) => key + 1);
    setCalcProduct(product);
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom,
          backgroundColor: colors.background,
        }}
      >
        <LinearGradient
          colors={[colors.surface, colors.background]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            overflow: "hidden",
          }}
        >
          <DotPattern opacity={0.05} />
          <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Row
              verticalAlignment="center"
              horizontalArrangement="spaceAround"
              modifiers={[fillMaxWidth(), height(DOCK_HEIGHT)]}
            >
              <DockItem
                icon="home"
                label={t("drawer.home")}
                active={pathname === "/"}
                onPress={() => go("/")}
              />
              <DockItem
                icon="list"
                label={t("drawer.notes")}
                active={pathname === "/notas"}
                onPress={() => go("/notas")}
              />
              <Spacer modifiers={[width(56)]} />
              <DockItem
                icon="receipt-long"
                label={t("drawer.tickets")}
                active={pathname === "/tickets"}
                onPress={() => go("/tickets")}
              />
              <DockItem
                icon="menu"
                label={t("menu.title")}
                active={false}
                onPress={openMenu}
              />
            </Row>
          </M3Host>
        </LinearGradient>

        <View
          style={{
            position: "absolute",
            left: "50%",
            bottom: DOCK_HEIGHT - 20,
            marginLeft: -32,
            padding: 4,
            borderRadius: 32,
            backgroundColor: colors.background,
          }}
        >
          <IconButton
            icon="add"
            label={t("dock.searchTitle")}
            onPress={openSearch}
            variant="filled"
            size={56}
            iconSize={28}
          />
        </View>
      </View>

      <MenuSheet visible={menuOpen} onClose={closeMenu} />
      <DockSearchSheet
        key={`dock-search-${searchKey}`}
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onCalc={openCalc}
      />
      <CalculatorSheet
        key={`dock-calc-${calcKey}`}
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

function DockItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: SymbolName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Surface
      onClick={onPress}
      selected={active}
      color={active ? colors.accentContainer : "#00000000"}
      contentColor={active ? colors.onAccentContainer : colors.muted}
      shape={Shape.Pill({})}
      modifiers={[size(52, 52)]}
    >
      <Column
        horizontalAlignment="center"
        verticalArrangement="center"
        modifiers={[size(52, 52)]}
      >
        <SymbolIcon
          name={icon}
          size={24}
          tint={active ? colors.accent : colors.muted}
          label={label}
        />
        <Surface
          color={active ? colors.accent : "#00000000"}
          shape={Shape.Pill({})}
          modifiers={[width(18), height(3)]}
        />
      </Column>
    </Surface>
  );
}
