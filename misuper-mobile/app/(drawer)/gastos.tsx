import { Screen } from "@/components/screen";
import { Card } from "@/components/m3/card";
import { ProgressBar } from "@/components/m3/feedback";
import { ValueRow } from "@/components/m3/lists";
import { M3Text } from "@/components/m3/text";
import { formatCurrency, monthName } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";

const CATEGORIES = ["despensa", "limpieza", "otros"] as const;

/** Spending: the month's total and where it goes, by category. */
export default function SpendingScreen() {
  useLocale();
  return (
    <Screen title={t("spending.title")}>
      <Card elevated>
        <M3Text variant="caption" color="muted">
          {t("spending.monthTotal")}
        </M3Text>
        <M3Text variant="display">{formatCurrency(0)}</M3Text>
        <M3Text variant="caption" color="muted">
          {`${monthName()} · ${t("spending.noComparison")}`}
        </M3Text>
        <ProgressBar fraction={0} />
        <M3Text variant="caption" color="muted">
          {t("spending.noData")}
        </M3Text>
      </Card>

      <Card>
        <M3Text variant="subtitle">{t("spending.categories")}</M3Text>
        <M3Text variant="caption" color="muted">
          {t("spending.empty")}
        </M3Text>
        {CATEGORIES.map((category) => (
          <ValueRow
            key={category}
            label={t(`spending.${category}`)}
            value={formatCurrency(0)}
          />
        ))}
      </Card>

      <Card>
        <M3Text variant="subtitle">{t("spending.subtitle")}</M3Text>
        <M3Text variant="caption" color="muted">
          {t("common.comingSoon")}
        </M3Text>
      </Card>
    </Screen>
  );
}
