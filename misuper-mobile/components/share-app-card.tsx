/** Share Mi Súper with a QR and the Android share sheet. */

import { Image, Share, Text, View } from "react-native";
import { Button } from "@/components/m3/buttons";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

const SHARE_URL = "https://misuper.iguzman.com.mx";

const QR_SOURCE = require("@/assets/misuper-qr.png");

export function ShareAppCard() {
  useLocale();
  const { colors } = useTheme();

  const shareLink = async () => {
    try {
      await Share.share({
        title: t("share.title"),
        message: t("share.message", { url: SHARE_URL }),
      });
    } catch {
      showToast(t("share.error"), "error");
    }
  };

  return (
    <TextureCard>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
        {t("share.title")}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
        {t("share.hint")}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            padding: 6,
            borderRadius: 12,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Image
            source={QR_SOURCE}
            style={{ width: 132, height: 132 }}
            resizeMode="contain"
            accessibilityLabel={t("share.qrLabel")}
          />
        </View>

        <View style={{ flex: 1, gap: 8 }}>
          <Text
            selectable
            style={{
              color: colors.foreground,
              fontSize: 12,
              fontWeight: "600",
              lineHeight: 17,
            }}
          >
            {SHARE_URL}
          </Text>
          <Button
            label={t("share.action")}
            variant="outlined"
            onPress={() => void shareLink()}
          />
        </View>
      </View>
    </TextureCard>
  );
}
