/** Edit one dish: move it, change portions/note/label or replace the recipe. */

import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/m3/buttons";
import { NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { M3Text } from "@/components/m3/text";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import type { MenuItem } from "@/lib/menu";
import { showToast } from "@/lib/toast";

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const MOMENTS = ["desayuno", "comida", "cena", "colacion", "otro"];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 30,
        paddingHorizontal: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: active ? colors.onAccent : colors.foreground,
          fontSize: 11,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MenuEditSheet({
  visible,
  item,
  onClose,
  onChanged,
  onDeleted,
  onReplace,
}: {
  visible: boolean;
  item: MenuItem;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onReplace: () => void;
}) {
  useLocale();
  const { colors } = useTheme();
  const [portions, setPortions] = useState(String(item.porciones));
  const [note, setNote] = useState(item.nota ?? "");
  const [dia, setDia] = useState(item.dia);
  const [momento, setMomento] = useState(item.momento);
  const [etiqueta, setEtiqueta] = useState(item.etiqueta ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExtra = momento === "colacion" || momento === "otro";

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      if (item.tipo === "nota") {
        if (note.trim().length < 2) {
          setError(t("menu.noteRequired"));
          return;
        }
        await apiFetch<unknown>(`/api/menu/items/${item.id}`, {
          method: "PUT",
          body: {
            dia,
            momento,
            etiqueta: isExtra ? etiqueta.trim() : null,
            nota: note.trim(),
          },
        });
      } else {
        const value = Number(portions);
        await apiFetch<unknown>(`/api/menu/items/${item.id}`, {
          method: "PUT",
          body: {
            dia,
            momento,
            etiqueta: isExtra ? etiqueta.trim() : null,
            porciones: Number.isFinite(value)
              ? Math.max(1, Math.round(value))
              : item.porciones,
          },
        });
      }

      showToast(t("menu.updated"), "success");
      onChanged();
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(t("menu.deleteTitle"), t("menu.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("menu.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<unknown>(`/api/menu/items/${item.id}`, {
                method: "DELETE",
              });
              showToast(t("menu.deleted"), "success");
              onDeleted();
              onClose();
            } catch (caught) {
              setError(apiErrorMessage(caught));
            }
          })();
        },
      },
    ]);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={item.tipo === "nota" ? t("menu.editNote") : t("menu.editRecipe")}
      footer={
        <NativeContent>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={saving ? t("common.loading") : t("common.save")}
                icon="check"
                onPress={() => void save()}
                disabled={saving}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t("menu.delete")}
                variant="outlined"
                icon="delete"
                onPress={remove}
                disabled={saving}
              />
            </View>
          </View>
        </NativeContent>
      }
    >
      <NativeContent>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
          <View style={{ gap: 5 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11.5,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {t("recipes.day")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {DAYS.map((value) => (
                <Chip
                  key={value}
                  label={t(`menu.day.${value}`)}
                  active={dia === value}
                  onPress={() => setDia(value)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 5 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11.5,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {t("recipes.moment")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {MOMENTS.map((value) => (
                <Chip
                  key={value}
                  label={t(`menu.moment.${value}`)}
                  active={momento === value}
                  onPress={() => setMomento(value)}
                />
              ))}
            </View>
          </View>

          {isExtra ? (
            <TextField
              value={etiqueta}
              onChangeText={setEtiqueta}
              label={t("menu.extraLabel")}
              placeholder={t("menu.extraLabelPlaceholder")}
            />
          ) : null}

          {item.tipo === "nota" ? (
            <TextField
              value={note}
              onChangeText={setNote}
              label={t("menu.note")}
              multiline
              minLines={4}
              maxLines={8}
            />
          ) : (
            <>
              <TextField
                value={portions}
                onChangeText={setPortions}
                label={t("recipes.portions")}
                keyboardType="number"
              />
              <Button
                label={t("menu.replaceRecipe")}
                variant="outlined"
                icon="refresh"
                onPress={onReplace}
                disabled={saving}
              />
            </>
          )}

          {error ? (
            <M3Text
              variant="caption"
              color="error"
              modifiers={[padding(0, 4, 0, 0)]}
            >
              {error}
            </M3Text>
          ) : null}
        </View>
      </NativeContent>
    </BottomSheet>
  );
}
