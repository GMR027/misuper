/**
 * Shared update state: the card in Settings, the dot on the hamburger and
 * the badge in the menu all read the same check.
 */

import { createStore, useStore } from "@/lib/store";
import {
  fetchAppRelease,
  installedApp,
  updateStatus,
  type AppRelease,
  type UpdateStatus,
} from "@/lib/app-release";
import { apiErrorMessage } from "@/lib/api";

export interface AppUpdateState {
  release: AppRelease | null;
  status: UpdateStatus | null;
  loading: boolean;
  checked: boolean;
  error: string | null;
}

export const appUpdateStore = createStore<AppUpdateState>({
  release: null,
  status: null,
  loading: false,
  checked: false,
  error: null,
});

let inFlight: Promise<void> | null = null;

/**
 * Checks the published release once per session. `force` re-checks from the
 * Settings card.
 */
export function refreshAppUpdate(force = false): Promise<void> {
  if (inFlight !== null) return inFlight;

  const current = appUpdateStore.get();

  if (current.checked && !force) return Promise.resolve();

  appUpdateStore.set((prev) => ({ ...prev, loading: true, error: null }));

  inFlight = (async () => {
    try {
      const release = await fetchAppRelease();
      appUpdateStore.set((prev) => ({
        ...prev,
        release,
        status: updateStatus(release, installedApp()),
        loading: false,
        checked: true,
      }));
    } catch (caught) {
      appUpdateStore.set((prev) => ({
        ...prev,
        loading: false,
        checked: true,
        error: apiErrorMessage(caught),
      }));
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useAppUpdate(): AppUpdateState {
  return useStore(appUpdateStore);
}
