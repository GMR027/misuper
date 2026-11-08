/**
 * The navigation drawer: Material 3 in Compose - the app's name and Close, the
 * drawer's pages, and the version at the foot. The page in front wears the
 * accent's tint.
 */

import Constants from "expo-constants";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Column,
  HorizontalDivider,
  Row,
  Shape,
  Surface,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { IconButton } from "@/components/m3/buttons";
import { M3Host } from "@/components/m3/host";
import { M3Text, SymbolIcon, type SymbolName } from "@/components/m3/text";
import { t, useLocale } from "@/lib/i18n";

type DrawerPage = "index" | "tickets" | "gastos" | "ajustes";

const PAGES: { page: DrawerPage; icon: SymbolName; label: string }[] = [
  { page: "index", icon: "home", label: "drawer.home" },
  { page: "tickets", icon: "receipt-long", label: "drawer.tickets" },
  { page: "gastos", icon: "savings", label: "drawer.spending" },
  { page: "ajustes", icon: "settings", label: "drawer.settings" },
];

export function AppDrawer({ navigation, state }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  useLocale();
  const current = state.routes[state.index]?.name;

  const show = (page: DrawerPage) => {
    navigation.closeDrawer();
    if (page !== current) navigation.navigate(page);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <M3Host matchContents={false} style={{ flex: 1 }}>
        <Column modifiers={[fillMaxSize()]}>
          <Row
            verticalAlignment="center"
            modifiers={[fillMaxWidth(), padding(16, 8, 8, 8)]}
          >
            <M3Text variant="subtitle" weight="700" modifiers={[weight(1)]}>
              {t("app.name")}
            </M3Text>
            <IconButton
              icon="close"
              label={t("common.close")}
              onPress={() => navigation.closeDrawer()}
            />
          </Row>
          <HorizontalDivider color={colors.border} />
          <M3Text
            variant="caption"
            color="muted"
            modifiers={[padding(20, 14, 20, 4)]}
          >
            {t("drawer.tagline")}
          </M3Text>

          <Column
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[
              weight(1),
              fillMaxWidth(),
              verticalScroll(),
              padding(12, 4, 12, 8),
            ]}
          >
            {PAGES.map(({ page, icon, label }) => (
              <DrawerEntry
                key={page}
                icon={icon}
                label={t(label)}
                active={current === page}
                onPress={() => show(page)}
              />
            ))}
          </Column>

          <HorizontalDivider color={colors.border} />
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}
          >
            <M3Text variant="caption" color="muted">
              {`v${Constants.expoConfig?.version ?? "0.1.0"}`}
            </M3Text>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 6 }}
              modifiers={[clickable(() => show("ajustes"))]}
            >
              <SymbolIcon name="info" size={16} label={t("drawer.settings")} />
              <M3Text variant="caption" color="muted">
                {t("settings.title")}
              </M3Text>
            </Row>
          </Row>
        </Column>
      </M3Host>
    </View>
  );
}

/** Material 3's navigation drawer item: a symbol and a label on a round surface. */
function DrawerEntry({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: SymbolName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const ink = active ? colors.onAccentContainer : colors.foreground;
  return (
    <Surface
      onClick={onPress}
      selected={active}
      shape={Shape.Pill({})}
      color={active ? colors.accentContainer : "#00000000"}
      contentColor={ink}
      modifiers={[fillMaxWidth(), height(56)]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxSize(), padding(16, 0, 24, 0)]}
      >
        <SymbolIcon name={icon} size={24} tint={ink} />
        <M3Text variant="label" weight={active ? "700" : "500"} color={ink}>
          {label}
        </M3Text>
      </Row>
    </Surface>
  );
}
