import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MenuAddSheet } from "@/components/menu-add-sheet";
import { MenuEditSheet } from "@/components/menu-edit-sheet";
import { MenuListSheet } from "@/components/menu-list-sheet";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { useResponsive } from "@/lib/responsive";
import { t, useLocale } from "@/lib/i18n";
import {
  currentMonday,
  isoDate,
  shortDate,
  weekRangeLabel,
  type MenuItem,
  type MenuResponse,
  type MenuSemana,
} from "@/lib/menu";
import { showToast } from "@/lib/toast";

const MAIN_MOMENTS = ["desayuno", "comida", "cena"];
const OTHER_MOMENTS = ["colacion", "otro"];

function weekEnd(week: string): string {
  const date = new Date(`${week}T00:00:00`);
  date.setDate(date.getDate() + 6);
  return isoDate(date);
}

function shiftWeek(week: string, days: number): string {
  const date = new Date(`${week}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export default function WeeklyMenuScreen() {
  useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const { contentWidth } = useResponsive();
  const dayColumns = contentWidth >= 980 ? 3 : contentWidth >= 640 ? 2 : 1;
  const [weeks, setWeeks] = useState<MenuSemana[]>([]);
  const [week, setWeek] = useState("");
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addTarget, setAddTarget] = useState<{ day: number; moment: string } | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [replacing, setReplacing] = useState<MenuItem | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<MenuSemana[]>("/api/menu/semanas");

        if (!alive) return;

        const list = Array.isArray(data) ? data : [];
        setWeeks(list);
        const current = list.find((item) => item.es_actual) ?? list[0];
        setWeek(current?.semana ?? currentMonday());
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (week === "") return;

    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      void apiFetch<MenuResponse>(`/api/menu?semana=${week}`)
        .then((data) => {
          if (alive) setMenu(data);
        })
        .catch((caught) => {
          if (alive) setError(apiErrorMessage(caught));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [week, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const goWeek = (next: string) => {
    setWeek(next);
    setMenu(null);
  };

  const copyWeek = () => {
    const source = shiftWeek(week, -7);
    Alert.alert(
      t("menu.copyTitle"),
      t("menu.copyBody", { week: weekRangeLabel(source, weekEnd(source)) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("menu.copy"),
          onPress: () => {
            void (async () => {
              try {
                await apiFetch<unknown>("/api/menu/copiar", {
                  method: "POST",
                  body: {
                    origen_semana: source,
                    destino_semana: week,
                    reemplazar: true,
                  },
                });
                showToast(t("menu.copied"), "success");
                refresh();
              } catch (caught) {
                showToast(apiErrorMessage(caught), "error");
              }
            })();
          },
        },
      ],
    );
  };

  const clearWeek = () => {
    Alert.alert(t("menu.clearTitle"), t("menu.clearBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("menu.clear"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<unknown>(`/api/menu?semana=${week}`, {
                method: "DELETE",
              });
              showToast(t("menu.cleared"), "success");
              refresh();
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            }
          })();
        },
      },
    ]);
  };

  const weekCurrent = weeks.find((item) => item.semana === week);
  const range = weekRangeLabel(week || currentMonday(), weekEnd(week || currentMonday()));
  const summary = menu?.resumen;

  return (
    <>
      <Screen title={t("menu.weekly")}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => goWeek(shiftWeek(week || currentMonday(), -7))}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 20 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}
            >
              {range}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {weekCurrent?.es_actual
                ? t("menu.currentWeek")
                : t("menu.weekLabel")}
            </Text>
          </View>
          <Pressable
            onPress={() => goWeek(shiftWeek(week || currentMonday(), 7))}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 20 }}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => goWeek(currentMonday())}
            hitSlop={6}
            style={{
              height: 40,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}
            >
              {t("menu.today")}
            </Text>
          </Pressable>
        </View>

        {weeks.length > 0 ? (
          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11.5,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                paddingHorizontal: 2,
              }}
            >
              {t("menu.savedWeeks")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {weeks.map((item) => {
                const active = item.semana === week;
                return (
                  <Pressable
                    key={item.semana}
                    onPress={() => goWeek(item.semana)}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active
                        ? colors.accent
                        : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.onAccent : colors.foreground,
                        fontSize: 12,
                        fontWeight: active ? "700" : "500",
                      }}
                    >
                      {weekRangeLabel(item.semana, item.semana_fin)}
                      {item.items > 0 ? ` · ${item.items}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {summary ? (
          <TextureCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {t("menu.estimatedCost")}
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 23,
                    fontWeight: "800",
                  }}
                >
                  {formatCurrency(summary.total)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {t("menu.estimatedKcal")}
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 23,
                    fontWeight: "800",
                  }}
                >
                  {`${Math.round(summary.kcal_total)}`}
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {`${
                summary.recetas === 1
                  ? t("menu.recipeOne")
                  : t("menu.recipesCount", { count: summary.recetas })
              } · ${
                summary.items === 1
                  ? t("menu.dishOne")
                  : t("menu.dishesCount", { count: summary.items })
              }`}
            </Text>
            {summary.sin_precio > 0 ? (
              <Text style={{ color: colors.warning, fontSize: 12 }}>
                {summary.sin_precio === 1
                  ? t("menu.sinPrecioOne")
                  : t("menu.sinPrecio", { count: summary.sin_precio })}
              </Text>
            ) : null}
            {summary.no_disponibles > 0 ? (
              <Text style={{ color: colors.warning, fontSize: 12 }}>
                {summary.no_disponibles === 1
                  ? t("menu.noDisponiblesOne")
                  : t("menu.noDisponibles", { count: summary.no_disponibles })}
              </Text>
            ) : null}
            {summary.precios_viejos > 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {t("menu.preciosViejos", { count: summary.precios_viejos })}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                label={t("menu.generateList")}
                icon="shopping-cart"
                onPress={() => setListOpen(true)}
              />
              <Button
                label={t("menu.copyPrevious")}
                variant="outlined"
                icon="refresh"
                onPress={copyWeek}
              />
              <Button
                label={t("menu.clear")}
                variant="outlined"
                icon="delete"
                onPress={clearWeek}
              />
            </View>
          </TextureCard>
        ) : null}

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 28 }}>
            <Spinner />
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}

        {!loading && menu && menu.dias.length === 0 ? (
          <TextureCard>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                textAlign: "center",
                paddingVertical: 14,
              }}
            >
              {t("menu.emptyWeek")}
            </Text>
          </TextureCard>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          {menu?.dias.map((day) => {
            const otherItems = day.items.filter((item) =>
              OTHER_MOMENTS.includes(item.momento),
            );

            return (
              <TextureCard
                key={day.dia}
                style={{
                  width:
                    dayColumns === 1
                      ? "100%"
                      : dayColumns === 2
                        ? "48.9%"
                        : "32.2%",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: day.es_hoy ? colors.accent : colors.foreground,
                        fontSize: 15,
                        fontWeight: "800",
                      }}
                    >
                      {t(`menu.day.${day.dia}`)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {shortDate(day.fecha)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {formatCurrency(day.total)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                      {`${Math.round(day.kcal_total)} kcal`}
                    </Text>
                  </View>
                </View>

                {MAIN_MOMENTS.map((moment) => {
                  const items = day.items.filter((item) => item.momento === moment);

                  return (
                    <View key={moment} style={{ gap: 4, paddingTop: 2 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            color: colors.muted,
                            fontSize: 11.5,
                            fontWeight: "700",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {t(`menu.moment.${moment}`)}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setAddTarget({ day: day.dia, moment })
                          }
                          hitSlop={8}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.accent,
                              fontSize: 16,
                              lineHeight: 17,
                            }}
                          >
                            +
                          </Text>
                        </Pressable>
                      </View>

                      {items.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => setEditing(item)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingVertical: 4,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          }}
                        >
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.foreground,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              {item.nombre}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                              {item.tipo === "nota"
                                ? item.nota ?? item.nombre
                                : `${formatQuantity(item.porciones)} ${
                                    item.porciones === 1
                                      ? t("menu.portion")
                                      : t("menu.portions")
                                  }${item.kcal != null ? ` · ${Math.round(item.kcal)} kcal` : ""}`}
                            </Text>
                          </View>
                          {item.costo ? (
                            <Text
                              style={{
                                color: colors.muted,
                                fontSize: 11.5,
                                fontWeight: "600",
                              }}
                            >
                              {formatCurrency(item.costo.total)}
                            </Text>
                          ) : null}
                        </Pressable>
                      ))}

                      {items.length === 0 ? (
                        <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                          {t("menu.emptyMoment")}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}

                {otherItems.length > 0 ? (
                  <View style={{ gap: 4, paddingTop: 2 }}>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 11.5,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {t("menu.others")}
                    </Text>
                    {otherItems.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => setEditing(item)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingVertical: 4,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.foreground,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            {item.nombre}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                            {`${t(`menu.moment.${item.momento}`)} · ${formatQuantity(
                              item.porciones,
                            )} ${t("menu.portions")}`}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <Pressable
                  onPress={() =>
                    setAddTarget({
                      day: day.dia,
                      moment: otherItems.length > 0 ? "colacion" : "otro",
                    })
                  }
                  style={{ paddingTop: 2 }}
                >
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
                    {t("menu.addOther")}
                  </Text>
                </Pressable>
              </TextureCard>
            );
          })}
        </View>
      </Screen>

      {addTarget ? (
        <MenuAddSheet
          visible
          week={week}
          day={addTarget.day}
          moment={addTarget.moment}
          onClose={() => setAddTarget(null)}
          onAdded={refresh}
        />
      ) : null}

      {editing ? (
        <MenuEditSheet
          visible
          item={editing}
          onClose={() => setEditing(null)}
          onChanged={refresh}
          onDeleted={refresh}
          onReplace={() => {
            const item = editing;
            setEditing(null);
            setReplacing(item);
          }}
        />
      ) : null}

      {replacing ? (
        <MenuAddSheet
          visible
          week={week}
          day={replacing.dia}
          moment={replacing.momento}
          replaceItem={replacing}
          onClose={() => setReplacing(null)}
          onAdded={refresh}
        />
      ) : null}

      {listOpen ? (
        <MenuListSheet
          visible
          week={week}
          onClose={() => setListOpen(false)}
          onDone={(id) => router.push(`/lista-compras/${id}`)}
        />
      ) : null}
    </>
  );
}
