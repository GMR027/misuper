/** Which global sheet is open; the top bar and the dock share it. */

import { createStore, useStore } from "@/lib/store";

export const menuStore = createStore(false);

export function openMenu(): void {
  menuStore.set(true);
}

export function closeMenu(): void {
  menuStore.set(false);
}

export function useMenuOpen(): boolean {
  return useStore(menuStore);
}
