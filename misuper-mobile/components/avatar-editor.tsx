/** Photo/preset avatar editor, matching the web's "Datos personales". */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch, apiUpload } from "@/lib/api";
import { updateUser, useAuth, type AuthUser } from "@/lib/auth";
import { avatarGradient } from "@/lib/avatars";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface AvatarPreset {
  id: string;
  emoji: string;
  label: string;
}

type Tab = "photo" | "preset";

export function AvatarEditor() {
  useLocale();
  const { colors } = useTheme();
  const auth = useAuth();
  const user = auth.user;
  const [catalog, setCatalog] = useState<AvatarPreset[]>([]);
  const [tab, setTab] = useState<Tab>(
    user?.avatar_tipo === "preset" ? "preset" : "photo",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void apiFetch<{ items: AvatarPreset[] }>("/api/avatars", { auth: false })
      .then((data) => {
        if (alive) setCatalog(Array.isArray(data.items) ? data.items : []);
      })
      .catch((caught) => {
        if (alive) setError(apiErrorMessage(caught));
      });

    return () => {
      alive = false;
    };
  }, []);

  const save = async (form: FormData, message: string) => {
    setBusy(true);
    setError(null);

    try {
      const updated = await apiUpload<AuthUser>("/api/me/avatar", form);
      await updateUser(updated);
      showToast(message, "success");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const choosePreset = (id: string) => {
    const form = new FormData();
    form.append("tipo", "preset");
    form.append("avatar", id);
    void save(form, t("avatar.saved"));
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(t("avatar.permission"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append("tipo", "foto");
    form.append(
      "foto",
      {
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob,
    );
    void save(form, t("avatar.saved"));
  };

  const remove = () => {
    const form = new FormData();
    form.append("tipo", "none");
    void save(form, t("avatar.removed"));
  };

  const hasAvatar =
    user?.avatar_tipo === "foto" || user?.avatar_tipo === "preset";

  return (
    <View style={card(colors)}>
      <Text style={title(colors)}>{t("account.profile")}</Text>
      <Text style={caption(colors)}>{t("avatar.hint")}</Text>

      <View style={{ alignItems: "center", gap: 8 }}>
        {user ? <Avatar user={user} size={96} border /> : null}
        <Text style={caption(colors)}>
          {user?.avatar_tipo === "foto"
            ? t("avatar.photoCurrent")
            : user?.avatar_tipo === "preset"
              ? t("avatar.presetCurrent", {
                  label: user.avatar_label ?? t("avatar.preset"),
                })
              : t("avatar.none")}
        </Text>
        {hasAvatar ? (
          <Button
            label={t("avatar.remove")}
            variant="outlined"
            icon="delete"
            onPress={remove}
            disabled={busy}
          />
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable
          onPress={() => setTab("photo")}
          style={tabPill(tab === "photo", colors)}
        >
          <Text
            style={{
              color: tab === "photo" ? colors.onAccent : colors.muted,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {t("avatar.uploadTab")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("preset")}
          style={tabPill(tab === "preset", colors)}
        >
          <Text
            style={{
              color: tab === "preset" ? colors.onAccent : colors.muted,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {t("avatar.presetTab")}
          </Text>
        </Pressable>
      </View>

      {tab === "photo" ? (
        <View style={{ gap: 8 }}>
          <Text style={caption(colors)}>{t("avatar.photoHint")}</Text>
          <Button
            label={busy ? t("avatar.uploading") : t("avatar.choosePhoto")}
            icon="upload-file"
            onPress={() => void pickPhoto()}
            disabled={busy}
          />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {catalog.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Spinner />
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {catalog.map((preset) => {
                const selected =
                  user?.avatar_tipo === "preset" &&
                  user.avatar_valor === preset.id;
                const [from, to] = avatarGradient(preset.id);
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => choosePreset(preset.id)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={preset.label}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      borderWidth: selected ? 3 : 1,
                      borderColor: selected ? colors.accent : colors.border,
                      padding: 2,
                    }}
                  >
                    <LinearGradient
                      colors={[from, to]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        flex: 1,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{preset.emoji}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={caption(colors)}>
            {t("avatar.count", { count: catalog.length })}
          </Text>
        </View>
      )}

      {error ? (
        <Text style={{ color: colors.error, fontSize: 11 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function card(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  } as const;
}

function title(colors: ReturnType<typeof useTheme>["colors"]) {
  return { color: colors.foreground, fontSize: 16, fontWeight: "700" } as const;
}

function caption(colors: ReturnType<typeof useTheme>["colors"]) {
  return { color: colors.muted, fontSize: 12 } as const;
}

function tabPill(
  active: boolean,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  return {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: active ? colors.accent : colors.surface2,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.border,
  };
}
