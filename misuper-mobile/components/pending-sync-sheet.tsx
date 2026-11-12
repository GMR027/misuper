/** The list of purchases waiting to upload, with manual sync and discard. */

import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button, IconButton } from "@/components/m3/buttons";
import { ListRow } from "@/components/m3/lists";
import { useTheme } from "@/components/theme";
import { apiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import {
  descartarPendiente,
  flushOutbox,
  listarPendientes,
  type CompraPendiente,
} from "@/lib/offline/outbox";
import { showToast } from "@/lib/toast";

export function PendingSyncSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  useLocale();
  const { colors } = useTheme();
  const [items, setItems] = useState<CompraPendiente[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setItems(await listarPendientes());
  };

  useEffect(() => {
    if (!visible) return;

    let alive = true;

    void listarPendientes()
      .then((pendientes) => {
        if (!alive) return;

        setItems(pendientes);
        setError(null);
      })
      .catch((caught) => {
        if (alive) setError(apiErrorMessage(caught));
      });

    return () => {
      alive = false;
    };
  }, [visible]);

  const sincronizar = async () => {
    if (sincronizando) return;

    setSincronizando(true);
    setError(null);

    try {
      const resultado = await flushOutbox({ forzar: true });
      await cargar();

      if (resultado.enviados > 0) {
        showToast(
          t("sync.uploaded", { count: resultado.enviados }),
          "success",
        );
      }

      if (resultado.pendientes === 0) {
        onClose();
        return;
      }

      if (resultado.bloqueados === 0) {
        setError(t("sync.failed"));
      }
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSincronizando(false);
    }
  };

  const descartar = (item: CompraPendiente) => {
    Alert.alert(
      t("sync.discardTitle"),
      t("sync.discardBody", { fecha: item.fecha }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("sync.discard"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await descartarPendiente(item.id);
                await cargar();
                showToast(t("sync.discarded"), "info");
              } catch (caught) {
                setError(apiErrorMessage(caught));
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("sync.title")}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Button
            label={sincronizando ? t("sync.syncing") : t("sync.now")}
            icon="refresh"
            onPress={() => void sincronizar()}
            disabled={sincronizando || items.length === 0}
          />
        </View>
      }
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
          {t("sync.hint")}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text
          style={{
            color: colors.muted,
            fontSize: 13,
            textAlign: "center",
            paddingVertical: 24,
            paddingHorizontal: 16,
          }}
        >
          {t("sync.empty")}
        </Text>
      ) : (
        <View>
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={
                item.comercio === ""
                  ? item.fecha
                  : `${item.fecha} · ${item.comercio}`
              }
              summary={[
                t("sync.items", { count: item.itemsCount }),
                formatCurrency(item.total),
                item.bloqueado
                  ? (item.ultimoError ?? t("sync.blocked"))
                  : null,
              ]
                .filter((parte) => parte !== null)
                .join(" · ")}
              trailing={
                item.bloqueado ? (
                  <IconButton
                    icon="delete"
                    label={t("sync.discard")}
                    variant="standard"
                    color={colors.error}
                    onPress={() => descartar(item)}
                    size={36}
                    iconSize={20}
                  />
                ) : null
              }
            />
          ))}
        </View>
      )}

      {error !== null ? (
        <Text
          style={{
            color: colors.error,
            fontSize: 12,
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}
