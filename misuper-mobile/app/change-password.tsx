import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/m3/buttons";
import { Card } from "@/components/m3/card";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import { authErrorMessage } from "@/lib/auth-errors";
import { changeForcedPassword, logout } from "@/lib/auth";
import { t, useLocale } from "@/lib/i18n";

/**
 * Shown only while the account has `debe_cambiar_password`; the web does the
 * same after an admin reset. The current token stays valid after the change.
 */
export default function ChangePasswordScreen() {
  useLocale();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;

    if (password.length < 8) {
      setError(t("changePassword.short"));
      return;
    }

    if (password !== confirm) {
      setError(t("changePassword.mismatch"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await changeForcedPassword(password);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("changePassword.title")}
      subtitle={t("changePassword.subtitle")}
    >
      <Card>
        <TextField
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          label={t("changePassword.new")}
          secure
          keyboardType="password"
        />
        <TextField
          value={confirm}
          onChangeText={(value) => {
            setConfirm(value);
            setError(null);
          }}
          label={t("changePassword.confirm")}
          secure
          keyboardType="password"
        />
        {error ? (
          <M3Text variant="caption" color="error">
            {error}
          </M3Text>
        ) : null}
        <Button
          label={busy ? t("changePassword.saving") : t("changePassword.submit")}
          icon="check"
          onPress={() => void submit()}
          disabled={busy}
        />
        <Button
          label={t("account.logout")}
          variant="text"
          onPress={() => void logout()}
        />
      </Card>
    </AuthLayout>
  );
}
