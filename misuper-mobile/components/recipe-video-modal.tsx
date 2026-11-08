/* eslint-disable react-hooks/static-components */
/** A YouTube recipe video in a full-screen in-app window. */

import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/components/theme";
import { t } from "@/lib/i18n";
import {
  recipeVideoWatchUrl,
  type RecetaVideo,
} from "@/lib/recipes";

/** Loaded only when the video window opens: a missing native module must not
 * break the rest of the app on startup. */
function loadWebView(): typeof import("react-native-webview").WebView | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webview").WebView;
  } catch {
    return null;
  }
}

export function RecipeVideoModal({
  visible,
  video,
  title,
  onClose,
  onOpenExternal,
}: {
  visible: boolean;
  video: RecetaVideo | null;
  title: string;
  onClose: () => void;
  onOpenExternal: (url: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const WebView = loadWebView();

  if (video === null) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.foreground,
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {video.titulo ?? title}
            </Text>
            <Pressable
              onPress={() => onOpenExternal(recipeVideoWatchUrl(video))}
              hitSlop={6}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 11.5,
                  fontWeight: "600",
                  paddingTop: 2,
                }}
              >
                {t("recipes.openYouTube")}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface2,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 19,
                fontWeight: "700",
                lineHeight: 21,
              }}
            >
              ×
            </Text>
          </Pressable>
        </View>

        {WebView ? (
          <WebView
            source={{
              uri: `${video.embed_url}?autoplay=1&origin=https%3A%2F%2Fwww.youtube.com`,
              headers: { Referer: "https://www.youtube.com/" },
            }}
            style={{ flex: 1, backgroundColor: "#000000" }}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            startInLoadingState
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              gap: 12,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
              {t("recipes.videoUnavailable")}
            </Text>
            <Pressable
              onPress={() => onOpenExternal(recipeVideoWatchUrl(video))}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: colors.accent,
              }}
            >
              <Text
                style={{
                  color: colors.onAccent,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {t("recipes.openYouTube")}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
