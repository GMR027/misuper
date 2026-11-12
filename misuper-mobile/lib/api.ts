/**
 * The client for the PHP backend.
 *
 * The base URL is the one saved in Ajustes; otherwise `EXPO_PUBLIC_API_URL`
 * (build time), and finally production. The app authenticates with a Bearer
 * token issued by /api/mobile/auth/login; the web keeps using its session.
 */

import { getSettings } from "@/lib/settings";

const DEFAULT_API_URL = "https://misuper.iguzman.com.mx";
const ENV_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();

/** JSON requests give up after this and count as offline. */
const REQUEST_TIMEOUT_MS = 15_000;

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Called when a request with a token answers 401 (expired or revoked). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/** The API's base URL, without a trailing slash. */
export function getApiUrl(): string {
  const saved = getSettings().apiUrl.trim();
  return (saved || ENV_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "HTTP_ERROR",
    readonly data: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** false for login/register/health: never attach a stale token. */
  auth?: boolean;
}

/** `apiFetch<{ total: number }>("/api/gastos")`. Returns the `data` field. */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const base = getApiUrl();

  if (!base) {
    throw new ApiError(
      "Configura la URL del servidor en Ajustes.",
      0,
      "NO_SERVER",
    );
  }

  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  if (authToken && options.auth !== false) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let body: RequestInit["body"];

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }

  let response: Awaited<ReturnType<typeof fetch>>;
  // A phone on a bad network can leave `fetch` hanging for a minute; after
  // this the request counts as offline and the caller can queue the work.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(
      `${base}${path.startsWith("/") ? path : `/${path}`}`,
      { method, headers, body, signal: controller.signal },
    );
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor.",
      0,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  const envelope =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const success = response.ok && envelope?.ok === true;

  if (!success) {
    const error =
      envelope?.error !== null && typeof envelope?.error === "object"
        ? (envelope.error as Record<string, unknown>)
        : null;
    const message =
      typeof error?.message === "string"
        ? error.message
        : `HTTP ${response.status}`;
    const code =
      typeof error?.code === "string" ? error.code : "HTTP_ERROR";

    if (response.status === 401 && options.auth !== false) {
      unauthorizedHandler?.();
    }

    throw new ApiError(message, response.status, code, envelope?.data ?? null);
  }

  return envelope.data as T;
}

/**
 * Multipart upload through XMLHttpRequest.
 *
 * Expo's `fetch` (the winter runtime) rejects React Native's `{ uri }` file
 * parts with "Unsupported FormDataPart implementation"; XHR still hands them
 * to the native networking layer, which reads the file from the URI.
 */
export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const base = getApiUrl();

  if (!base) {
    return Promise.reject(
      new ApiError(
        "Configura la URL del servidor en Ajustes.",
        0,
        "NO_SERVER",
      ),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${base}${path.startsWith("/") ? path : `/${path}`}`);
    xhr.setRequestHeader("Accept", "application/json");

    if (authToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    }

    xhr.onload = () => {
      let payload: unknown = null;

      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          payload = xhr.responseText;
        }
      }

      const envelope =
        payload !== null && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;
      const success =
        xhr.status >= 200 && xhr.status < 300 && envelope?.ok === true;

      if (!success) {
        const error =
          envelope?.error !== null && typeof envelope?.error === "object"
            ? (envelope.error as Record<string, unknown>)
            : null;
        const message =
          typeof error?.message === "string"
            ? error.message
            : `HTTP ${xhr.status}`;
        const code =
          typeof error?.code === "string" ? error.code : "HTTP_ERROR";

        if (xhr.status === 401) {
          unauthorizedHandler?.();
        }

        reject(
          new ApiError(message, xhr.status, code, envelope?.data ?? null),
        );
        return;
      }

      resolve(envelope.data as T);
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          "No se pudo conectar con el servidor.",
          0,
          "NETWORK_ERROR",
        ),
      );
    xhr.ontimeout = () =>
      reject(
        new ApiError(
          "La subida tardó demasiado. Inténtalo de nuevo.",
          0,
          "TIMEOUT",
        ),
      );
    xhr.timeout = 120000;
    xhr.send(form);
  });
}

/** 0 when the API answers; the reason it does not, otherwise. */
export async function checkApi(): Promise<string | null> {
  try {
    await apiFetch<unknown>("/api/health", { auth: false });
    return null;
  } catch (error) {
    return apiErrorMessage(error);
  }
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo conectar con el servidor.";
}

/**
 * True when the request never reached the server: no signal, a wrong URL or a
 * dropped connection. Status 0 covers NO_SERVER and NETWORK_ERROR.
 */
export function isOfflineError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 0 || error.code === "NETWORK_ERROR")
  );
}

/** The first field error of a 422, when the API sends one. */
export function apiFieldError(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.data === null) return null;
  if (typeof error.data !== "object") return null;

  const first = Object.values(error.data as Record<string, unknown>).find(
    (value) => typeof value === "string",
  );

  return typeof first === "string" ? first : null;
}
