/** A tiny global toast, like the web's toast stack. */

import { createStore } from "@/lib/store";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

export const toastStore = createStore<ToastMessage | null>(null);

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, kind: ToastKind = "info"): void {
  toastStore.set({ id: nextId++, message, kind });

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => toastStore.set(null), 3200);
}
