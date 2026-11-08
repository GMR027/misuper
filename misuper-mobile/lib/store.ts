/**
 * A value kept outside React, read with `useStore`. Settings, the API client's
 * last state and work that outlives a screen live here, so a screen can
 * unmount and come back without losing them.
 */

import { useSyncExternalStore } from "react";

export interface Store<T> {
  get(): T;
  /** A new value, or one made from the current; the same object changes nothing. */
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

/** `onChange` runs after every change, before the listeners (saving it, say). */
export function createStore<T>(
  initial: T,
  onChange?: (value: T) => void,
): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      onChange?.(value);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The store's value, re-rendering when it changes. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

/** One piece of the store's value, re-rendering only when that piece changes. */
export function useStoreSelect<T, S>(store: Store<T>, select: (value: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
