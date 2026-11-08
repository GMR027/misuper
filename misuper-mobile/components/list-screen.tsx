/** A drawer page with a FlatList: same textures and top bar as Screen. */

import type { ReactElement, ReactNode } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { DotPattern, PageBackground, useTheme } from "@/components/theme";
import { useAuth } from "@/lib/auth";
import { DOCK_HEIGHT } from "@/lib/layout";
import { openMenu } from "@/lib/ui-store";

export function ListScreen<T>({
  title,
  data,
  renderItem,
  keyExtractor,
  numColumns = 1,
  columnWrapperStyle,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  contentContainerStyle,
  extraData,
  refreshing = false,
  onRefresh,
}: {
  title: string;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  numColumns?: number;
  columnWrapperStyle?: StyleProp<ViewStyle>;
  ListHeaderComponent?: ReactElement | null;
  ListFooterComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraData?: unknown;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <PageBackground />
      <View style={{ height: 60, overflow: "hidden" }}>
        <DotPattern opacity={scheme === "dark" ? 0.1 : 0.045} />
        <LinearGradient
          pointerEvents="none"
          colors={
            scheme === "dark"
              ? ["rgba(255,255,255,0.04)", "transparent"]
              : ["rgba(255,255,255,0.5)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60 }}
        />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={openMenu}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            {auth.user ? (
              <Avatar user={auth.user} size={38} border />
            ) : (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: colors.surface2,
                }}
              />
            )}
          </Pressable>
        </View>
      </View>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={ListEmptyComponent}
        extraData={extraData}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          {
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: insets.bottom + DOCK_HEIGHT + 32,
          },
          contentContainerStyle,
        ]}
      />
    </View>
  );
}

/** A separator used between rows in list mode. */
export function ListGap({ size = 8 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export type { ReactNode };
