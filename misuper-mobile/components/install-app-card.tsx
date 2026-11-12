/** Download and install the latest APK, with an update indicator. */

import { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { Button } from "@/components/m3/buttons";
import { ProgressBar, Spinner } from "@/components/m3/feedback";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import {
  apkUrl,
  installedApp,
} from "@/lib/app-release";
import { refreshAppUpdate, useAppUpdate } from "@/lib/app-update-store";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

const APK_FILE = "misuper-update.apk";

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 12,
          fontWeight: "700",
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function InstallAppCard() {
  useLocale();
  const { colors } = useTheme();
  const installed = installedApp();
  const { release, status, loading, checked, error } = useAppUpdate();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{
    written: number;
    total: number;
  } | null>(null);
  const lastPercent = useRef(-1);

  // The card owns the first check of the session; other screens reuse it.
  useEffect(() => {
    void refreshAppUpdate();
  }, []);

  const check = () => {
    void refreshAppUpdate(true);
  };

  const badge =
    status === null
      ? null
      : status === "outdated"
        ? { label: t("install.updateAvailable"), color: colors.warning }
        : status === "ahead"
          ? { label: t("install.ahead"), color: colors.muted }
          : { label: t("install.upToDate"), color: colors.success };

  const percent =
    progress !== null && progress.total > 0
      ? Math.min(100, Math.round((progress.written / progress.total) * 100))
      : null;

  const install = async () => {
    if (downloading) return;

    const url = apkUrl(release);
    lastPercent.current = -1;
    setDownloading(true);
    setProgress({ written: 0, total: release?.size ?? -1 });

    try {
      const destination = new File(Paths.cache, APK_FILE);

      if (destination.exists) destination.delete();

      const task = File.createDownloadTask(url, destination, {
        onProgress: ({ bytesWritten, totalBytes }) => {
          const current =
            totalBytes > 0
              ? Math.floor((bytesWritten / totalBytes) * 100)
              : -1;

          if (current === lastPercent.current) return;

          lastPercent.current = current;
          setProgress({ written: bytesWritten, total: totalBytes });
        },
      });

      const file = await task.downloadAsync();

      if (!file) throw new Error(t("install.downloadFailed"));

      if (
        release !== null &&
        Number.isFinite(release.size) &&
        release.size > 0 &&
        file.size !== release.size
      ) {
        file.delete();
        throw new Error(t("install.sizeMismatch"));
      }

      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: file.contentUri,
        type: "application/vnd.android.package-archive",
        flags: 1,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      showToast(
        message === t("install.sizeMismatch")
          ? message
          : t("install.downloadFailed"),
        "error",
      );

      // If the system cannot open the installer, the browser still can.
      try {
        await Linking.openURL(url);
      } catch {
        // Nothing else to offer from here.
      }
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  return (
    <TextureCard>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
        {t("install.title")}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
        {t("install.hint")}
      </Text>

      <View style={{ gap: 6 }}>
        <InfoRow
          label={t("install.installed")}
          value={
            installed.code !== null
              ? `${installed.version} (${installed.code})`
              : installed.version
          }
        />
        {release !== null ? (
          <InfoRow
            label={t("install.latest")}
            value={`${release.version} (${release.version_code})`}
          />
        ) : null}
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Spinner />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {t("install.checking")}
          </Text>
        </View>
      ) : error !== null ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.error, fontSize: 12 }}>
            {t("install.checkFailed")}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 10.5 }}>
            {error}
          </Text>
        </View>
      ) : badge !== null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: badge.color,
            }}
          />
          <Text
            style={{ color: badge.color, fontSize: 12, fontWeight: "700" }}
          >
            {badge.label}
          </Text>
        </View>
      ) : null}

      {downloading ? (
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>
            {percent !== null
              ? t("install.downloadingPercent", { percent })
              : t("install.downloading")}
          </Text>
          <ProgressBar fraction={percent === null ? null : percent / 100} />
        </View>
      ) : null}

      {status === "outdated" ? (
        <Button
          label={downloading ? t("install.downloading") : t("install.downloadUpdate")}
          icon="refresh"
          onPress={() => void install()}
          disabled={downloading}
        />
      ) : null}

      {status === null && checked && !loading ? (
        <Button
          label={t("install.download")}
          onPress={() => void install()}
          disabled={downloading}
        />
      ) : null}

      <Button
        label={t("install.check")}
        variant="text"
        onPress={() => void check()}
        disabled={loading || downloading}
      />

      <Text style={{ color: colors.muted, fontSize: 10.5, lineHeight: 15 }}>
        {t("install.installHint")}
      </Text>
    </TextureCard>
  );
}
