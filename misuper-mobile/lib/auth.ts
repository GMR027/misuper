/**
 * The app's session: the Bearer token from /api/mobile/auth/login, kept in
 * Android's encrypted storage, and the user it belongs to.
 *
 * The web keeps using its PHP session; this store is only for the Android app.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { clearCart } from "@/lib/cart";
import { limpiarTicketsPendientes } from "@/lib/offline/tickets";
import { resetOfflineData } from "@/lib/offline/schema";
import { createStore, useStore } from "@/lib/store";
import { readText, writeText } from "@/lib/db";
import {
  apiFetch,
  setAuthToken,
  setUnauthorizedHandler,
  type ApiError as ApiErrorType,
} from "@/lib/api";

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  debe_cambiar_password: boolean;
  avatar_tipo: string | null;
  avatar_valor: string | null;
  avatar_emoji: string | null;
  avatar_label: string | null;
}

export interface AuthState {
  status: "loading" | "guest" | "authenticated";
  user: AuthUser | null;
}

interface SessionResponse {
  token: string;
  expires_at: string;
  usuario: AuthUser;
}

const TOKEN_KEY = "misuper.auth.token";
const USER_KEY = "misuper.auth.user";

export const authStore = createStore<AuthState>({
  status: "loading",
  user: null,
});

let started = false;

async function readSecret(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // SecureStore can fail on an emulator without a keystore. The SQLite
    // fallback keeps the session usable; the token is still only on device.
    return readText(key);
  }
}

async function writeSecret(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    writeText(key, value);
  }
}

async function deleteSecret(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Fall through to the SQLite copy.
  }
  writeText(key, null);
}

function parseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AuthUser;
    return typeof value?.id === "number" && typeof value?.email === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

async function saveUser(user: AuthUser): Promise<void> {
  await writeSecret(USER_KEY, JSON.stringify(user));
}

async function saveSession(token: string, user: AuthUser): Promise<void> {
  setAuthToken(token);
  await writeSecret(TOKEN_KEY, token);
  await saveUser(user);
  authStore.set({ status: "authenticated", user });
}

/** Clears the local session; the caller may also revoke the token server-side. */
export async function clearSession(): Promise<void> {
  // The cart belongs to the signed-in account; never hand it to the next one.
  clearCart();
  // Same for the offline catalog, cached prices, pending syncs and photos.
  await limpiarTicketsPendientes().catch(() => undefined);
  await resetOfflineData().catch(() => undefined);
  setAuthToken(null);
  await deleteSecret(TOKEN_KEY);
  await deleteSecret(USER_KEY);
  authStore.set({ status: "guest", user: null });
}

/**
 * Restores the saved session. It trusts the cached user first so the app can
 * open without waiting for the network, then refreshes it in the background;
 * a 401 clears the session through the API client's handler.
 */
export async function initAuth(): Promise<void> {
  if (started) return;
  started = true;

  const token = await readSecret(TOKEN_KEY);

  if (!token) {
    setAuthToken(null);
    authStore.set({ status: "guest", user: null });
    return;
  }

  const cached = parseUser(await readSecret(USER_KEY));
  setAuthToken(token);

  if (!cached) {
    try {
      const user = await apiFetch<AuthUser>("/api/me");
      await saveSession(token, user);
    } catch {
      await clearSession();
    }
    return;
  }

  authStore.set({
    status: "authenticated",
    user: cached,
  });

  try {
    const user = await apiFetch<AuthUser>("/api/me");
    await saveUser(user);
    authStore.set({ status: "authenticated", user });
  } catch (error) {
    const status = (error as ApiErrorType)?.status;
    if (status !== 401) {
      // Offline: keep the cached session; screens will show their own error.
      return;
    }
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<SessionResponse>("/api/mobile/auth/login", {
    method: "POST",
    auth: false,
    body: {
      email,
      password,
      device_name: deviceName(),
    },
  });

  await saveSession(data.token, data.usuario);
  return data.usuario;
}

export async function register(
  nombre: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const data = await apiFetch<SessionResponse>("/api/mobile/auth/register", {
    method: "POST",
    auth: false,
    body: {
      nombre,
      email,
      password,
      device_name: deviceName(),
    },
  });

  await saveSession(data.token, data.usuario);
  return data.usuario;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ message: string }>("/api/mobile/auth/logout", {
      method: "POST",
    });
  } catch {
    // Offline or already revoked: the local session still has to go.
  }

  await clearSession();
}

export async function refreshUser(): Promise<AuthUser> {
  const user = await apiFetch<AuthUser>("/api/me");
  await saveUser(user);
  authStore.set({ status: "authenticated", user });
  return user;
}

/** Replaces the cached user after an avatar or profile change. */
export async function updateUser(user: AuthUser): Promise<void> {
  await saveUser(user);
  authStore.set({ status: "authenticated", user });
}

/** The forced change after an admin reset; keeps the current token. */
export async function changeForcedPassword(password: string): Promise<void> {
  await apiFetch<{ message: string }>("/api/me/password-forzado", {
    method: "POST",
    body: { password_nueva: password },
  });
  await refreshUser();
}

export function useAuth(): AuthState {
  return useStore(authStore);
}

function deviceName(): string {
  return Platform.OS === "android"
    ? `Android ${String(Platform.Version)}`
    : `iOS ${String(Platform.Version)}`;
}

setUnauthorizedHandler(() => {
  void clearSession();
});
