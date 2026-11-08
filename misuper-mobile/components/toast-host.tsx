/** The toast pill, positioned above the dock and cart bar. */

import { View } from "react-native";
import { Row, Shape, Surface } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { CART_BAR_HEIGHT, DOCK_HEIGHT } from "@/lib/layout";
import { useStore } from "@/lib/store";
import { toastStore, type ToastKind } from "@/lib/toast";

export function ToastHost({ cartBar = false }: { cartBar?: boolean }) {
  const toast = useStore(toastStore);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (!toast) return null;

  const bottom =
    insets.bottom +
    DOCK_HEIGHT +
    (cartBar ? CART_BAR_HEIGHT + 24 : 24);

  const tone = toneFor(toast.kind, colors.success, colors.error);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom,
      }}
    >
      <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Surface
          color={colors.surface}
          contentColor={colors.foreground}
          shape={Shape.RoundedCorner({
            cornerRadii: {
              topStart: 14,
              topEnd: 14,
              bottomStart: 14,
              bottomEnd: 14,
            },
          })}
          border={{ width: 1, color: colors.border }}
          shadowElevation={4}
          modifiers={[fillMaxWidth(), padding(12, 10, 12, 10)]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth()]}
          >
            <SymbolIcon
              name={toast.kind === "error" ? "info" : "check"}
              size={18}
              tint={tone}
            />
            <M3Text variant="caption" weight="600">
              {toast.message}
            </M3Text>
          </Row>
        </Surface>
      </Compose>
    </View>
  );
}

function toneFor(kind: ToastKind, success: string, error: string): string {
  if (kind === "success") return success;
  if (kind === "error") return error;
  return success;
}
