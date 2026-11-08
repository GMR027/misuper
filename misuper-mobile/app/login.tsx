import { useState } from "react";
import { useRouter } from "expo-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/m3/buttons";
import { Card } from "@/components/m3/card";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import {
  checkApi,
  getApiUrl,
} from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import { login } from "@/lib/auth";
import { t, useLocale } from "@/lib/i18n";
import { setSettings } from "@/lib/settings";

/** Email and password against the PHP backend, then the drawer. */
export default function LoginScreen() {
  useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(() => getApiUrl());
  const [showServer, setShowServer] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveServer = () => {
    setSettings({ apiUrl: server.trim().replace(/\/+$/, "") });
  };

  const submit = async () => {
    if (busy) return;

    const correo = email.trim();

    if (correo === "" || password === "") {
      setError(t("login.missingFields"));
      return;
    }

    saveServer();
    setBusy(true);
    setError(null);

    try {
      await login(correo, password);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (testing) return;
    saveServer();
    setTesting(true);
    setTestResult(null);

    const result = await checkApi();
    setTestResult(
      result === null
        ? t("login.testOk")
        : t("login.testFail", { error: result }),
    );
    setTesting(false);
  };

  return (
    <AuthLayout title={t("login.title")} subtitle={t("login.subtitle")}>
      <Card>
        <TextField
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          label={t("login.email")}
          placeholder={t("login.emailPlaceholder")}
          keyboardType="email"
        />
        <TextField
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          label={t("login.password")}
          secure
          keyboardType="password"
        />
        {error ? (
          <M3Text variant="caption" color="error">
            {error}
          </M3Text>
        ) : null}
        <Button
          label={busy ? t("login.signingIn") : t("login.submit")}
          icon="check"
          onPress={() => void submit()}
          disabled={busy}
        />
        <Button
          label={t("login.register")}
          variant="text"
          onPress={() => router.push("/register")}
        />
      </Card>

      <Card>
        <M3Text variant="subtitle">{t("login.server")}</M3Text>
        <M3Text variant="caption" color="muted">
          {t("login.serverCurrent", { url: server.trim() || getApiUrl() })}
        </M3Text>
        <Button
          label={showServer ? t("login.serverHide") : t("login.serverChange")}
          variant="outlined"
          icon="settings"
          onPress={() => {
            setShowServer((visible) => !visible);
            setTestResult(null);
          }}
        />
        {showServer ? (
          <>
            <TextField
              value={server}
              onChangeText={(value) => {
                setServer(value);
                setTestResult(null);
              }}
              label={t("login.apiUrl")}
              placeholder={t("login.apiUrlPlaceholder")}
              keyboardType="uri"
            />
            <Button
              label={testing ? t("login.testing") : t("login.test")}
              variant="tonal"
              icon="wifi"
              onPress={() => void test()}
              disabled={testing}
            />
            {testResult ? (
              <M3Text variant="caption" color="muted">
                {testResult}
              </M3Text>
            ) : null}
          </>
        ) : null}
      </Card>
    </AuthLayout>
  );
}
