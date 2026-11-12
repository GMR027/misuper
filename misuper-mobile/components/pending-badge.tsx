/** A chip with how many purchases are waiting to upload, and the sheet behind it. */

import { useState } from "react";
import { Pressable, Text } from "react-native";
import { PendingSyncSheet } from "@/components/pending-sync-sheet";
import { SymbolIcon } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { t, useLocale } from "@/lib/i18n";
import { usePendientes } from "@/lib/offline/outbox";

export function PendingBadge() {
  useLocale();
  const { colors } = useTheme();
  const pendientes = usePendientes();
  const [abierto, setAbierto] = useState(false);

  if (pendientes === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={t("sync.open")}
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: `${colors.warning}1f`,
          borderWidth: 1,
          borderColor: `${colors.warning}55`,
        }}
      >
        <SymbolIcon name="upload-file" size={18} tint={colors.warning} />
        <Text
          style={{ color: colors.warning, fontSize: 12, fontWeight: "700" }}
        >
          {t("sync.badge", { count: pendientes })}
        </Text>
      </Pressable>

      <PendingSyncSheet
        visible={abierto}
        onClose={() => setAbierto(false)}
      />
    </>
  );
}
