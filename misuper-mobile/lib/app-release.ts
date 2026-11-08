/** The latest Android release published by the backend, and the update check. */

import * as Application from "expo-application";
import { apiFetch, getApiUrl } from "@/lib/api";

export interface AppRelease {
  version: string;
  version_code: number;
  apk_url: string;
  size: number;
  sha256: string;
  md5?: string;
  published_at?: string;
}

export interface InstalledApp {
  version: string;
  code: number | null;
}

export type UpdateStatus = "current" | "outdated" | "ahead";

/** What this phone is running, from the native build (not the JS bundle). */
export function installedApp(): InstalledApp {
  const code = Number(Application.nativeBuildVersion ?? "");

  return {
    version: Application.nativeApplicationVersion ?? "—",
    code: Number.isFinite(code) && code > 0 ? code : null,
  };
}

/** Public endpoint; no token needed. The timestamp avoids a cached answer. */
export function fetchAppRelease(): Promise<AppRelease> {
  return apiFetch<AppRelease>(`/api/app/version?t=${Date.now()}`, {
    auth: false,
  });
}

function versionParts(value: string): number[] {
  return value
    .split(".")
    .map((part) => Number.parseInt(part.replace(/\D/g, ""), 10) || 0);
}

function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  const size = Math.max(a.length, b.length);

  for (let index = 0; index < size; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);

    if (difference !== 0) return difference;
  }

  return 0;
}

export function updateStatus(
  release: AppRelease,
  installed: InstalledApp,
): UpdateStatus {
  if (installed.code !== null && Number.isFinite(release.version_code)) {
    if (release.version_code > installed.code) return "outdated";
    if (release.version_code < installed.code) return "ahead";

    return "current";
  }

  const difference = compareVersions(release.version, installed.version);

  return difference > 0 ? "outdated" : difference < 0 ? "ahead" : "current";
}

/** The release URL, or the stable download path when the check failed. */
export function apkUrl(release: AppRelease | null): string {
  return (
    release?.apk_url ??
    `${getApiUrl()}/descargas/misuper.apk?t=${Date.now()}`
  );
}
