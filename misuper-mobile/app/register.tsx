import { useState } from "react";
import { useRouter } from "expo-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/m3/buttons";
import { Card } from "@/components/m3/card";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import { getApiUrl } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import { register } from "@/lib/auth";
import { t, useLocale } from "@/lib/i18n";

/** Registration against the web backend; the token is returned right away. */
export default function RegisterScreen() {
  useLocale();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;

    const name = nombre.trim();
    const correo = email.trim();

    if (name === "" || correo === "") {
      setError(t("register.missingFields"));
      return;
    }

    if (password.length < 8) {
      setError(t("register.passwordShort"));
      return;
    }

    if (password !== confirm) {
      setError(t("register.passwordMismatch"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await register(name, correo, password);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t("register.title")} subtitle={t("register.subtitle")}>
      <Card>
        <TextField
          value={nombre}
          onChangeText={(value) => {
            setNombre(value);
            setError(null);
          }}
          label={t("register.name")}
          placeholder={t("register.namePlaceholder")}
        />
        <TextField
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          label={t("register.email")}
          placeholder={t("login.emailPlaceholder")}
          keyboardType="email"
        />
        <TextField
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          label={t("register.password")}
          secure
          keyboardType="password"
        />
        <TextField
          value={confirm}
          onChangeText={(value) => {
            setConfirm(value);
            setError(null);
          }}
          label={t("register.confirm")}
          secure
          keyboardType="password"
        />
        {error ? (
          <M3Text variant="caption" color="error">
            {error}
          </M3Text>
        ) : null}
        <Button
          label={busy ? t("register.creating") : t("register.submit")}
          icon="check"
          onPress={() => void submit()}
          disabled={busy}
        />
        <Button
          label={t("register.haveAccount")}
          variant="text"
          onPress={() => router.replace("/login")}
        />
      </Card>

      <Card>
        <M3Text variant="caption" color="muted">
          {t("register.serverHint", { url: getApiUrl() })}
        </M3Text>
        <Button
          label={t("register.serverChange")}
          variant="outlined"
          icon="settings"
          onPress={() => router.replace("/login")}
        />
      </Card>
    </AuthLayout>
  );
}
