/** The dock's menu sheet: user, sections and logout, like the web. */

import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheet } from "@/components/bottom-sheet";
import { Avatar } from "@/components/avatar";
import { NativeContent } from "@/components/m3/host";
import { ListRow } from "@/components/m3/lists";
import { SymbolIcon } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { logout, useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";

type MenuRoute =
  | "/"
  | "/notas"
  | "/gastos"
  | "/tickets"
  | "/historial"
  | "/lista-compras"
  | "/recetas"
  | "/menu"
  | "/metricas"
  | "/precios"
  | "/admin/recetas"
  | "/admin/productos"
  | "/admin/usuarios"
  | "/ajustes";

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

  const go = (path: MenuRoute) => {
    onClose();
    router.navigate(path);
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
      <ListRow
        title={t("drawer.home")}
        onPress={() => go("/")}
        leading={<SymbolIcon name="home" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <ListRow
        title={t("shopping.title")}
        onPress={() => go("/lista-compras")}
        leading={<SymbolIcon name="shopping-cart" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <ListRow
        title={t("drawer.tickets")}
        onPress={() => go("/tickets")}
        leading={<SymbolIcon name="receipt-long" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <ListRow
        title={t("history.title")}
        onPress={() => go("/historial")}
        leading={<SymbolIcon name="list" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />


      <SectionLabel label={t("menu.kitchen")} />
      <ListRow
        title={t("menu.weekly")}
        onPress={() => go("/menu")}
        leading={<SymbolIcon name="menu" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <ListRow
        title={t("recipes.title")}
        onPress={() => go("/recetas")}
        leading={<SymbolIcon name="list" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />

      <SectionLabel label={t("menu.analysis")} />
      <ListRow
        title={t("metrics.title")}
        onPress={() => go("/metricas")}
        leading={<SymbolIcon name="grid-view" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <ListRow
        title={t("prices.title")}
        onPress={() => go("/precios")}
        leading={<SymbolIcon name="savings" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />

      <SectionLabel label={t("menu.personalSection")} />
      <ListRow
        title={t("drawer.notes")}
        onPress={() => go("/notas")}
        leading={<SymbolIcon name="list" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />

      {user?.rol === "admin" ? (
        <>
          <SectionLabel label={t("menu.adminSection")} />
          <ListRow
            title={t("admin.recipes")}
            onPress={() => go("/admin/recetas")}
            leading={<SymbolIcon name="list" size={22} />}
            trailing={<SymbolIcon name="chevron-right" size={18} />}
          />
          <ListRow
            title={t("admin.products")}
            onPress={() => go("/admin/productos")}
            leading={<SymbolIcon name="shopping-cart" size={22} />}
            trailing={<SymbolIcon name="chevron-right" size={18} />}
          />
          <ListRow
            title={t("admin.users")}
            onPress={() => go("/admin/usuarios")}
            leading={<SymbolIcon name="info" size={22} />}
            trailing={<SymbolIcon name="chevron-right" size={18} />}
          />
        </>
      ) : null}

      <SectionLabel label={t("menu.settingsSection")} />
      <ListRow
        title={t("drawer.settings")}
        onPress={() => go("/ajustes")}
        leading={<SymbolIcon name="settings" size={22} />}
        trailing={<SymbolIcon name="chevron-right" size={18} />}
      />
      <ListRow
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
