/** The app's navigation: a five-slot bottom dock on phones, a rail when wide. */

import { useState } from "react";
import { View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Column, Row, Shape, Spacer, Surface } from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  size,
  weight,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { DotPattern, useTheme } from "@/components/theme";
import { CalculatorSheet } from "@/components/calculator-sheet";
import { DockSearchSheet } from "@/components/dock-search-sheet";
import { MenuSheet } from "@/components/menu-sheet";
import { M3Host } from "@/components/m3/host";
import { IconButton } from "@/components/m3/buttons";
import { M3Text, SymbolIcon, type SymbolName } from "@/components/m3/text";
import {
  DOCK_HEIGHT,
  RAIL_ITEM_HEIGHT,
  RAIL_ITEM_WIDTH,
  RAIL_WIDTH,
} from "@/lib/layout";
import type { Producto } from "@/lib/products";
import { useResponsive } from "@/lib/responsive";
import { showToast } from "@/lib/toast";
import { closeMenu, openMenu, useMenuOpen } from "@/lib/ui-store";
import { t } from "@/lib/i18n";

type DockRoute = "/" | "/notas" | "/tickets" | "/ajustes";

export function AppDock() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { useRail, height: windowHeight } = useResponsive();
  /** A landscape phone is ~360-460 dp tall: shrink the rail so it still fits. */
  const compactRail = windowHeight < 560;
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
      {useRail ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: RAIL_WIDTH + insets.left,
            paddingLeft: insets.left,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          }}
        >
          <LinearGradient
            colors={[colors.surface, colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              flex: 1,
              borderRightWidth: 1,
              borderRightColor: colors.border,
              overflow: "hidden",
            }}
          >
            <DotPattern opacity={0.05} />
            <M3Host matchContents={false} style={{ flex: 1 }}>
              <Column
                horizontalAlignment="center"
                modifiers={[fillMaxSize(), padding(8, compactRail ? 4 : 10, 8, 4)]}
              >
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: compactRail ? 2 : 6 }}
                  modifiers={[fillMaxWidth()]}
                >
                  <RailItem
                    icon="home"
                    label={t("drawer.home")}
                    active={pathname === "/"}
                    onPress={() => go("/")}
                    compact={compactRail}
                  />
                  <RailItem
                    icon="list"
                    label={t("drawer.notes")}
                    active={pathname === "/notas"}
                    onPress={() => go("/notas")}
                    compact={compactRail}
                  />
                  <RailItem
                    icon="receipt-long"
                    label={t("drawer.tickets")}
                    active={pathname === "/tickets"}
                    onPress={() => go("/tickets")}
                    compact={compactRail}
                  />
                  <RailItem
                    icon="menu"
                    label={t("menu.title")}
                    active={false}
                    onPress={openMenu}
                    compact={compactRail}
                  />
                  <RailItem
                    icon="settings"
                    label={t("drawer.settings")}
                    active={pathname === "/ajustes"}
                    onPress={() => go("/ajustes")}
                    compact={compactRail}
                  />
                </Column>
                <Spacer modifiers={[weight(1)]} />
                <IconButton
                  icon="add"
                  label={t("dock.searchTitle")}
                  onPress={openSearch}
                  variant="filled"
                  size={compactRail ? 48 : 56}
                  iconSize={compactRail ? 24 : 28}
                />
              </Column>
            </M3Host>
          </LinearGradient>
        </View>
      ) : (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
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
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: DOCK_HEIGHT - 20,
              alignItems: "center",
            }}
          >
            <View
              style={{
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
        </View>
      )}

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

function RailItem({
  icon,
  label,
  active,
  onPress,
  compact = false,
}: {
  icon: SymbolName;
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const ink = active ? colors.onAccentContainer : colors.muted;
  const itemHeight = compact ? 44 : RAIL_ITEM_HEIGHT;
  return (
    <Surface
      onClick={onPress}
      selected={active}
      color={active ? colors.accentContainer : "#00000000"}
      contentColor={ink}
      shape={Shape.RoundedCorner({
        cornerRadii: {
          topStart: 16,
          topEnd: 16,
          bottomStart: 16,
          bottomEnd: 16,
        },
      })}
      modifiers={[width(RAIL_ITEM_WIDTH), height(itemHeight)]}
    >
      <Column
        horizontalAlignment="center"
        verticalArrangement="center"
        modifiers={[size(RAIL_ITEM_WIDTH, itemHeight)]}
      >
        <SymbolIcon
          name={icon}
          size={compact ? 20 : 22}
          tint={active ? colors.accent : colors.muted}
          label={label}
        />
        <M3Text
          variant="caption"
          weight={active ? "700" : "500"}
          color={ink}
          maxLines={1}
        >
          {label}
        </M3Text>
      </Column>
    </Surface>
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
