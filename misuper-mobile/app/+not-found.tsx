import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/m3/buttons";
import { Card } from "@/components/m3/card";
import { M3Text } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { t, useLocale } from "@/lib/i18n";

export default function NotFoundScreen() {
  useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 24,
        paddingHorizontal: 16,
      }}
    >
      <Card>
        <M3Text variant="title">{t("notFound.title")}</M3Text>
        <M3Text variant="body" color="muted">
          {t("notFound.body")}
        </M3Text>
        <Button
          label={t("notFound.goHome")}
          icon="home"
          onPress={() => router.replace("/")}
        />
      </Card>
    </View>
  );
}
