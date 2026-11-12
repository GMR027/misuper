/** The dock's menu sheet: user, sections and logout, like the web. */

import type { ComponentProps } from "react";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Row } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import { BottomSheet } from "@/components/bottom-sheet";
import { Avatar } from "@/components/avatar";
import { NativeContent } from "@/components/m3/host";
import { ListRow } from "@/components/m3/lists";
import { Badge } from "@/components/m3/feedback";
import { SymbolIcon } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { logout, useAuth } from "@/lib/auth";
import { refreshAppUpdate, useAppUpdate } from "@/lib/app-update-store";
import { t } from "@/lib/i18n";

type MenuRoute =
  | "/"
  | "/notas"
  | "/gastos"
  | "/tickets"
  | "/historial"
  | "/lista-compras"
  | "/recetas"
  | "/productos-omision"
  | "/menu"
  | "/metricas"
  | "/precios"
  | "/admin/recetas"
  | "/admin/productos"
  | "/admin/usuarios"
  | "/ajustes";

/** ListRow has no side padding; the menu sheet adds it once here. */
function MenuRow(props: Omit<ComponentProps<typeof ListRow>, "modifiers">) {
  return <ListRow {...props} modifiers={[padding(16, 0, 16, 0)]} />;
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <NativeContent wrap>
      <Text
        style={{
          color: colors.muted,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 4,
        }}
      >
        {label}
      </Text>
    </NativeContent>
  );
}

export function MenuSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const auth = useAuth();
  const router = useRouter();
  const user = auth.user;
  const update = useAppUpdate();

  useEffect(() => {
    void refreshAppUpdate();
  }, []);

  const go = (path: MenuRoute) => {
    onClose();
    router.navigate(path as Parameters<typeof router.navigate>[0]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("menu.title")}>
      {user ? (
        <NativeContent wrap>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Avatar user={user} size={48} border />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {user.nombre}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {user.rol === "admin" ? t("menu.admin") : t("menu.personal")}
              </Text>
            </View>
          </View>
        </NativeContent>
      ) : null}

      <SectionLabel label={t("menu.shopping")} />
      <MenuRow
        title={t("drawer.home")}
        onPress={() => go("/")}
        leading={<SymbolIcon name="home" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <MenuRow
        title={t("shopping.title")}
        onPress={() => go("/lista-compras")}
        leading={<SymbolIcon name="shopping-cart" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <MenuRow
        title={t("drawer.tickets")}
        onPress={() => go("/tickets")}
        leading={<SymbolIcon name="receipt-long" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <MenuRow
        title={t("history.title")}
        onPress={() => go("/historial")}
        leading={<SymbolIcon name="list" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />


      <SectionLabel label={t("menu.kitchen")} />
      <MenuRow
        title={t("menu.weekly")}
        onPress={() => go("/menu")}
        leading={<SymbolIcon name="menu" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <MenuRow
        title={t("recipes.title")}
        onPress={() => go("/recetas")}
        leading={<SymbolIcon name="list" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <MenuRow
        title={t("omissions.title")}
        onPress={() => go("/productos-omision")}
        leading={<SymbolIcon name="close" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />

      <SectionLabel label={t("menu.analysis")} />
      <MenuRow
        title={t("metrics.title")}
        onPress={() => go("/metricas")}
        leading={<SymbolIcon name="grid-view" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <MenuRow
        title={t("prices.title")}
        onPress={() => go("/precios")}
        leading={<SymbolIcon name="savings" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />

      <SectionLabel label={t("menu.personalSection")} />
      <MenuRow
        title={t("drawer.notes")}
        onPress={() => go("/notas")}
        leading={<SymbolIcon name="list" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />

      {user?.rol === "admin" ? (
        <>
          <SectionLabel label={t("menu.adminSection")} />
          <MenuRow
            title={t("admin.recipes")}
            onPress={() => go("/admin/recetas")}
            leading={<SymbolIcon name="list" size={22} />}
            trailing={<SymbolIcon name="chevron-right" size={18} />}
          />
          <MenuRow
            title={t("admin.products")}
            onPress={() => go("/admin/productos")}
            leading={<SymbolIcon name="shopping-cart" size={22} />}
            trailing={<SymbolIcon name="chevron-right" size={18} />}
          />
          <MenuRow
            title={t("admin.users")}
            onPress={() => go("/admin/usuarios")}
            leading={<SymbolIcon name="info" size={22} />}
            trailing={<SymbolIcon name="chevron-right" size={18} />}
          />
        </>
      ) : null}

      <SectionLabel label={t("menu.settingsSection")} />
      <MenuRow
        title={t("drawer.settings")}
        onPress={() => go("/ajustes")}
        leading={<SymbolIcon name="settings" size={22} />}
        trailing={
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }}>
            {update.status === "outdated" ? (
              <Badge kind="warning">{t("install.updateShort")}</Badge>
            ) : null}
            <SymbolIcon name="chevron-right" size={18} />
          </Row>
        }
      />
      <MenuRow
        title={t("account.logout")}
        onPress={() => {
          onClose();
          void logout();
        }}
        leading={<SymbolIcon name="arrow-back" size={22} tint={colors.error} />}
        titleColor={colors.error}
      />
    </BottomSheet>
  );
}
