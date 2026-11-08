/** A multi-select sheet over the purchase history, used by "solo despensa". */

import { useEffect, useState } from "react";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { ListRow } from "@/components/m3/lists";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getLocale, t, useLocale } from "@/lib/i18n";
import type { CompraResumen } from "@/lib/recipes";

interface HistoryPage {
  items: CompraResumen[];
  total: number;
}

function purchaseDate(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  return new Intl.DateTimeFormat(getLocale() === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function PurchasePickerSheet({
  visible,
  onClose,
  selected,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  selected: number[];
  onApply: (ids: number[]) => void;
}) {
  useLocale();
  const [draft, setDraft] = useState<number[]>(selected);
  const [items, setItems] = useState<CompraResumen[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<HistoryPage>("/api/compras?page=1");

        if (!alive) return;

        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total);
        setPage(1);

        // First time: suggest the most recent purchase.
        if (selected.length === 0 && data.items.length > 0) {
          setDraft([data.items[0].id]);
        }
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selected.length]);

  const toggle = (id: number) => {
    setDraft((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const next = page + 1;
      const data = await apiFetch<HistoryPage>(`/api/compras?page=${next}`);
      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
      setPage(next);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const allLoadedSelected =
    items.length > 0 && items.every((item) => draft.includes(item.id));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("recipes.purchasesTitle")}
      footer={
        <Button
          label={
            draft.length === 0
              ? t("recipes.purchasesApplyLatest")
              : draft.length === 1
                ? t("recipes.purchasesApplyOne")
                : t("recipes.purchasesApply", { count: draft.length })
          }
          icon="check"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      }
    >
      <M3Text
        variant="caption"
        color="muted"
        modifiers={[padding(16, 2, 16, 6)]}
      >
        {t("recipes.purchasesHint")}
      </M3Text>

      {loading ? (
        <M3Text
          variant="body"
          color="muted"
          modifiers={[padding(16, 12, 16, 12)]}
        >
          {t("common.loading")}
        </M3Text>
      ) : null}

      {!loading ? (
        <ListRow
          title={
            allLoadedSelected
              ? t("recipes.purchasesClear")
              : t("recipes.purchasesAll")
          }
          summary={
            draft.length === 1
              ? t("recipes.purchasesSelectedOne")
              : t("recipes.purchasesSelected", { count: draft.length })
          }
          onPress={() =>
            setDraft(allLoadedSelected ? [] : items.map((item) => item.id))
          }
          modifiers={[padding(16, 0, 16, 0)]}
          leading={<SymbolIcon name="check" size={20} />}
        />
      ) : null}

      {error ? (
        <M3Text
          variant="caption"
          color="error"
          modifiers={[padding(16, 6, 16, 6)]}
        >
          {error}
        </M3Text>
      ) : null}

      {items.map((purchase) => {
        const active = draft.includes(purchase.id);
        const title =
          purchase.comercio?.trim() !== ""
            ? (purchase.comercio as string)
            : purchase.ticket_titulo?.trim() !== ""
              ? (purchase.ticket_titulo as string)
              : t("history.purchase");

        return (
          <ListRow
            key={purchase.id}
            title={title}
            summary={`${purchaseDate(purchase.fecha)} · ${t(
              "history.itemsCount",
              { count: purchase.items_count },
            )} · ${formatCurrency(purchase.total)}`}
            onPress={() => toggle(purchase.id)}
            modifiers={[padding(16, 0, 16, 0)]}
            trailing={
              <M3Text
                variant="subtitle"
                color={active ? "accent" : "muted"}
              >
                {active ? "✓" : "○"}
              </M3Text>
            }
          />
        );
      })}

      {items.length > 0 && items.length < total ? (
        <Button
          label={
            loadingMore ? t("common.loading") : t("recipes.purchasesMore")
          }
          variant="outlined"
          icon="refresh"
          onPress={() => void loadMore()}
          disabled={loadingMore}
        />
      ) : null}
    </BottomSheet>
  );
}
