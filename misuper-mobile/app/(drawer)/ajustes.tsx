import { useState } from "react";
import Constants from "expo-constants";
import { Alert, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { AppearanceEditor } from "@/components/appearance-editor";
import { Avatar } from "@/components/avatar";
import { AvatarEditor } from "@/components/avatar-editor";
import { InstallAppCard } from "@/components/install-app-card";
import { ShareAppCard } from "@/components/share-app-card";
import { Button, ChoiceButtons } from "@/components/m3/buttons";
import { Card } from "@/components/m3/card";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { clearSession, logout, updateUser, useAuth } from "@/lib/auth";
import { apiErrorMessage, apiFetch, getApiUrl } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import { useResponsive } from "@/lib/responsive";
import {
  setSettings,
  useSettings,
  type AppLocale,
} from "@/lib/settings";

type LanguageChoice = "system" | AppLocale;

/** Ajustes: the web's appearance/avatar editor, account, server and version. */
export default function SettingsScreen() {
  useLocale();
  const { colors } = useTheme();
  const auth = useAuth();
  const { useTwoPane } = useResponsive();
  const language = useSettings((s) => s.language);
  const [draft, setDraft] = useState(() => getApiUrl());
  const [saved, setSaved] = useState(false);
  const [nombre, setNombre] = useState(auth.user?.nombre ?? "");
  const [email, setEmail] = useState(auth.user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const saveApi = async () => {
    const previous = getApiUrl();
    const next = draft.trim().replace(/\/+$/, "");

    setSettings({ apiUrl: next });
    setSaved(true);

    // The token belongs to the old server; a different one needs a new login.
    if (next !== previous) {
      await logout();
    }
  };

  const saveProfile = async () => {
    if (savingProfile) return;

    if (nombre.trim().length < 2 || email.trim().length < 3) {
      setProfileMessage(t("account.profileRequired"));
      return;
    }

    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const updated = await apiFetch<typeof auth.user>(
        "/api/me",
        {
          method: "PUT",
          body: { nombre: nombre.trim(), email: email.trim() },
        },
      );

      if (updated) await updateUser(updated);
      setProfileMessage(t("account.profileSaved"));
    } catch (caught) {
      setProfileMessage(apiErrorMessage(caught));
    } finally {
      setSavingProfile(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t("account.deleteTitle"), t("account.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.deleteAccount"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<{ deleted: boolean }>("/api/me", {
                method: "DELETE",
                body: { confirmacion: true },
              });
              await clearSession();
            } catch (caught) {
              setProfileMessage(apiErrorMessage(caught));
            }
          })();
        },
      },
    ]);
  };

  const accountCard = (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 10,
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>
        {t("account.title")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {auth.user ? <Avatar user={auth.user} size={46} border /> : null}
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}
          >
            {auth.user?.nombre ?? "—"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {auth.user?.email ?? ""}
          </Text>
        </View>
      </View>
      <TextField
        value={nombre}
        onChangeText={setNombre}
        label={t("account.name")}
        placeholder={t("account.namePlaceholder")}
      />
      <TextField
        value={email}
        onChangeText={setEmail}
        label={t("account.email")}
        placeholder={t("account.emailPlaceholder")}
        keyboardType="email"
      />
      <Button
        label={savingProfile ? t("common.loading") : t("account.saveProfile")}
        icon="check"
        onPress={() => void saveProfile()}
        disabled={savingProfile}
      />
      {profileMessage ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {profileMessage}
        </Text>
      ) : null}
      <Button
        label={t("account.logout")}
        variant="outlined"
        icon="arrow-back"
        onPress={() => void logout()}
      />
      <Button
        label={t("account.deleteAccount")}
        variant="outlined"
        icon="delete"
        onPress={confirmDelete}
      />
    </View>
  );

  const appearanceColumn = (
    <>
      <AppearanceEditor />
      <AvatarEditor />
      <ShareAppCard />
      <InstallAppCard />
    </>
  );

  const preferencesColumn = (
    <>
      {accountCard}

      <Card>
        <M3Text variant="subtitle">{t("settings.language")}</M3Text>
        <ChoiceButtons<LanguageChoice>
          value={language ?? "system"}
          onChange={(next) =>
            setSettings({ language: next === "system" ? null : next })
          }
          options={[
            { value: "system", label: t("settings.languageSystem") },
            { value: "es", label: t("settings.languageSpanish") },
            { value: "en", label: t("settings.languageEnglish") },
          ]}
        />
      </Card>

      <Card>
        <M3Text variant="subtitle">{t("settings.server")}</M3Text>
        <M3Text variant="caption" color="muted">
          {t("settings.apiUrlHint")}
        </M3Text>
        <TextField
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setSaved(false);
          }}
          label={t("settings.apiUrl")}
          placeholder={t("settings.apiUrlPlaceholder")}
          keyboardType="uri"
        />
        <Button
          label={t("settings.save")}
          icon="check"
          onPress={() => void saveApi()}
        />
        {saved ? (
          <M3Text variant="caption" color="accent">
            {t("settings.saved")}
          </M3Text>
        ) : null}
        <M3Text variant="caption" color="muted">
          {t("settings.serverLogoutHint")}
        </M3Text>
      </Card>

      <Card>
        <M3Text variant="subtitle">{t("settings.about")}</M3Text>
        <M3Text variant="body">
          {t("settings.version", {
            version: Constants.expoConfig?.version ?? "0.1.0",
          })}
        </M3Text>
        <M3Text variant="caption" color="muted">
          {t("settings.aboutHint")}
        </M3Text>
        <M3Text variant="caption" color="muted">
          {t("settings.androidHint")}
        </M3Text>
      </Card>
    </>
  );

  return (
    <Screen title={t("settings.title")}>
      {useTwoPane ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <View style={{ flex: 1, gap: 12 }}>{appearanceColumn}</View>
          <View style={{ flex: 1, gap: 12 }}>{preferencesColumn}</View>
        </View>
      ) : (
        <>
          {appearanceColumn}
          {preferencesColumn}
        </>
      )}
    </Screen>
  );
}
