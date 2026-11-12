/** Keeps purchases and tickets saved offline moving: on open, on foreground and every minute. */

import { useEffect } from "react";
import { AppState } from "react-native";
import {
  flushOutbox,
  refrescarPendientes,
  usePendientes,
} from "@/lib/offline/outbox";
import {
  flushTickets,
  refrescarTicketsPendientes,
  useTicketsPendientes,
} from "@/lib/offline/tickets";

const REINTENTO_MS = 60_000;

export function OfflineSync() {
  const compras = usePendientes();
  const tickets = useTicketsPendientes();
  const hayPendientes = compras > 0 || tickets.length > 0;

  useEffect(() => {
    void refrescarPendientes().then(() => flushOutbox());
    void refrescarTicketsPendientes().then(() => flushTickets());
  }, []);

  useEffect(() => {
    const subscripcion = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") return;

      void flushOutbox();
      void flushTickets();
    });

    return () => subscripcion.remove();
  }, []);

  useEffect(() => {
    if (!hayPendientes) return;

    const timer = setInterval(() => {
      void flushOutbox();
      void flushTickets();
    }, REINTENTO_MS);

    return () => clearInterval(timer);
  }, [hayPendientes]);

  return null;
}
