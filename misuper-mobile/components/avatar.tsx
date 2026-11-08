/** A profile picture: uploaded photo, preset emoji or initials. */

import { useState } from "react";
import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/components/theme";
import { getApiUrl } from "@/lib/api";
import { avatarGradient, initials, resolveMediaUrl } from "@/lib/avatars";

export interface AvatarUser {
  nombre: string;
  avatar_tipo: string | null;
  avatar_valor: string | null;
  avatar_emoji: string | null;
}

export function Avatar({
  user,
  size = 40,
  border = false,
}: {
  user: AvatarUser;
  size?: number;
  border?: boolean;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const photo =
    !failed && user.avatar_tipo === "foto" && user.avatar_valor
      ? resolveMediaUrl(user.avatar_valor, getApiUrl())
      : null;

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...(border
      ? { borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.surface2 }
      : {}),
  };

  if (photo) {
    return (
      <View style={frame}>
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
          accessibilityLabel={`Foto de perfil de ${user.nombre}`}
        />
      </View>
    );
  }

  if (user.avatar_tipo === "preset" && user.avatar_valor) {
    const [from, to] = avatarGradient(user.avatar_valor);
    return (
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={frame}
      >
        <Text style={{ fontSize: size * 0.5 }}>{user.avatar_emoji ?? "🙂"}</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.accent, colors.accentStrong]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={frame}
    >
      <Text
        style={{
          color: colors.onAccent,
          fontSize: size * 0.34,
          fontWeight: "800",
          letterSpacing: 0.3,
        }}
      >
        {initials(user.nombre)}
      </Text>
    </LinearGradient>
  );
}
