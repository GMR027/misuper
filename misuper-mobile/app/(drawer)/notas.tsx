import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";
import { BottomSheet } from "@/components/bottom-sheet";
import { Screen } from "@/components/screen";
import { TextureCard } from "@/components/texture-card";
import { useTheme } from "@/components/theme";
import { Button, IconButton } from "@/components/m3/buttons";
import { Spinner } from "@/components/m3/feedback";
import { M3Host, NativeContent } from "@/components/m3/host";
import { TextField } from "@/components/m3/inputs";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import {
  apiErrorMessage,
  apiFetch,
  apiFieldError,
  apiUpload,
  getApiUrl,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatars";
import { useResponsive } from "@/lib/responsive";
import { t, useLocale } from "@/lib/i18n";
import { showToast } from "@/lib/toast";

interface NotaFoto {
  id: number;
  ruta: string;
}

interface Nota {
  id: number;
  titulo: string;
  contenido: string;
  fecha: string;
  created_at: string | null;
  updated_at: string | null;
  fotos: NotaFoto[];
}

const MAX_FOTOS = 8;

export default function NotesScreen() {
  useLocale();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useResponsive();
  const notesColumns = contentWidth >= 900 ? 3 : contentWidth >= 560 ? 2 : 1;
  const [items, setItems] = useState<Nota[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ items: Nota[]; total: number }>(
        "/api/notas",
      );
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const data = await apiFetch<{ items: Nota[]; total: number }>(
          "/api/notas",
        );

        if (!alive) return;

        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (caught) {
        if (alive) setError(apiErrorMessage(caught));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = items.filter((nota) => {
    const q = query.trim().toLocaleLowerCase();
    if (q === "") return true;
    return `${nota.titulo} ${nota.contenido}`.toLocaleLowerCase().includes(q);
  });

  const openNew = () => {
    setEditing(null);
    setTitulo("");
    setContenido("");
    setPendingPhotos([]);
    setEditorError(null);
    setEditorOpen(true);
  };

  const openEdit = (nota: Nota) => {
    setEditing(nota);
    setTitulo(nota.titulo);
    setContenido(nota.contenido);
    setPendingPhotos([]);
    setEditorError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setPendingPhotos([]);
    setEditorError(null);
  };

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const existing = editing?.fotos.length ?? 0;
    const room = MAX_FOTOS - existing - pendingPhotos.length;
    if (room <= 0) {
      showToast(t("notes.photoLimit"), "error");
      return;
    }
    setPendingPhotos((current) => [...current, ...assets.slice(0, room)]);
  };

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t("notes.permission"), "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_FOTOS - (editing?.fotos.length ?? 0) - pendingPhotos.length),
      quality: 0.7,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showToast(t("notes.cameraPermission"), "error");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  const uploadPhoto = async (notaId: number, asset: ImagePicker.ImagePickerAsset) => {
    const form = new FormData();
    form.append(
      "foto",
      {
        uri: asset.uri,
        name: asset.fileName ?? "nota.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob,
    );
    await apiUpload<NotaFoto>(`/api/notas/${notaId}/fotos`, form);
  };

  const save = async () => {
    if (saving) return;

    const title = titulo.trim();

    if (title.length < 2) {
      setEditorError(t("notes.titleRequired"));
      return;
    }

    setSaving(true);
    setEditorError(null);

    try {
      let nota = editing;
      const body = { titulo: title, contenido };

      nota = nota
        ? await apiFetch<Nota>(`/api/notas/${nota.id}`, {
            method: "PUT",
            body,
          })
        : await apiFetch<Nota>("/api/notas", { method: "POST", body });

      for (const asset of pendingPhotos) {
        await uploadPhoto(nota.id, asset);
      }

      await load();
      closeEditor();
      showToast(t("notes.saved"), "success");
    } catch (caught) {
      setEditorError(apiFieldError(caught) ?? apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async (fotoId: number) => {
    if (!editing) return;
    try {
      await apiFetch<{ deleted: boolean }>(
        `/api/notas/${editing.id}/fotos/${fotoId}`,
        { method: "DELETE" },
      );
      setEditing({
        ...editing,
        fotos: editing.fotos.filter((foto) => foto.id !== fotoId),
      });
      await load();
    } catch (caught) {
      showToast(apiErrorMessage(caught), "error");
    }
  };

  const removeNote = () => {
    if (!editing) return;
    Alert.alert(t("notes.deleteTitle"), t("notes.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("notes.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch<{ deleted: boolean }>(
                `/api/notas/${editing.id}`,
                { method: "DELETE" },
              );
              closeEditor();
              await load();
              showToast(t("notes.deleted"), "success");
            } catch (caught) {
              showToast(apiErrorMessage(caught), "error");
            }
          })();
        },
      },
    ]);
  };

  const existingFotos = editing?.fotos ?? [];
  const photoUrl = (ruta: string) =>
    resolveMediaUrl(ruta, getApiUrl()) ?? ruta;

  return (
    <>
      <Screen title={t("notes.title")}>
        <View style={{ gap: 10 }}>
          <TextField
            value={query}
            onChangeText={setQuery}
            label={t("notes.search")}
            placeholder={t("notes.searchPlaceholder")}
            leadingIcon="search"
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ flex: 1, color: colors.muted, fontSize: 12 }}>
              {t("notes.count", { count: filtered.length })}
            </Text>
            <Button
              label={t("notes.new")}
              icon="add"
              onPress={openNew}
            />
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Spinner />
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 12 }}>{error}</Text>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <TextureCard>
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 14,
              }}
            >
              {query.trim() === "" ? t("notes.empty") : t("notes.noResults")}
            </Text>
          </TextureCard>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {filtered.map((nota) => (
            <Pressable
              key={nota.id}
              onPress={() => openEdit(nota)}
              style={{
                width:
                  notesColumns === 1
                    ? "100%"
                    : notesColumns === 2
                      ? "48.9%"
                      : "32.2%",
              }}
            >
              <TextureCard>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: "700",
                      lineHeight: 21,
                    }}
                  >
                    {nota.titulo}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {nota.fecha}
                  </Text>
                </View>
                {nota.contenido.trim() !== "" ? (
                  <Text
                    numberOfLines={3}
                    style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}
                  >
                    {nota.contenido}
                  </Text>
                ) : null}
                {nota.fotos.length > 0 ? (
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {nota.fotos.slice(0, 4).map((foto) => (
                      <Pressable
                        key={foto.id}
                        onPress={() => setLightbox(photoUrl(foto.ruta))}
                      >
                        <Image
                          source={{ uri: photoUrl(foto.ruta) }}
                          style={{ width: 64, height: 64, borderRadius: 10 }}
                          resizeMode="cover"
                        />
                      </Pressable>
                    ))}
                    {nota.fotos.length > 4 ? (
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 10,
                          backgroundColor: colors.surface2,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          +{nota.fotos.length - 4}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </TextureCard>
            </Pressable>
          ))}
        </View>
      </Screen>

      <BottomSheet
        visible={editorOpen}
        onClose={closeEditor}
        title={editing ? t("notes.edit") : t("notes.new")}
        footer={
          <>
            <Button
              label={saving ? t("notes.saving") : t("common.save")}
              icon="check"
              onPress={() => void save()}
              disabled={saving}
            />
            {editing ? (
              <Button
                label={t("notes.delete")}
                variant="outlined"
                icon="delete"
                onPress={removeNote}
                disabled={saving}
              />
            ) : null}
          </>
        }
      >
        <TextField
          value={titulo}
          onChangeText={(value) => {
            setTitulo(value);
            setEditorError(null);
          }}
          label={t("notes.noteTitle")}
          placeholder={t("notes.titlePlaceholder")}
          modifiers={[fillMaxWidth(), padding(16, 2, 16, 2)]}
        />
        <TextField
          value={contenido}
          onChangeText={setContenido}
          label={t("notes.content")}
          placeholder={t("notes.contentPlaceholder")}
          multiline
          minLines={5}
          maxLines={10}
          modifiers={[fillMaxWidth(), padding(16, 2, 16, 2)]}
        />

        {(existingFotos.length > 0 || pendingPhotos.length > 0) ? (
          <NativeContent wrap>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 4,
              }}
            >
              {existingFotos.map((foto) => (
                <View key={`e-${foto.id}`} style={{ alignItems: "center", gap: 3 }}>
                  <Image
                    source={{ uri: photoUrl(foto.ruta) }}
                    style={{ width: 72, height: 72, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                  <IconButton
                    icon="delete"
                    label={t("notes.removePhoto")}
                    onPress={() => void removePhoto(foto.id)}
                    size={28}
                    iconSize={16}
                  />
                </View>
              ))}
              {pendingPhotos.map((asset, index) => (
                <View key={`p-${index}`} style={{ alignItems: "center", gap: 3 }}>
                  <Image
                    source={{ uri: asset.uri }}
                    style={{ width: 72, height: 72, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                  <IconButton
                    icon="delete"
                    label={t("notes.removePhoto")}
                    onPress={() =>
                      setPendingPhotos((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                    size={28}
                    iconSize={16}
                  />
                </View>
              ))}
            </View>
          </NativeContent>
        ) : null}

        <NativeContent wrap>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              flexWrap: "wrap",
              paddingHorizontal: 16,
              paddingTop: 6,
            }}
          >
            <Button
              label={t("notes.addPhotos")}
              variant="outlined"
              icon="upload-file"
              onPress={() => void pickPhotos()}
            />
            <Button
              label={t("notes.camera")}
              variant="outlined"
              icon="add"
              onPress={() => void takePhoto()}
            />
          </View>
        </NativeContent>
        <M3Text
          variant="caption"
          color="muted"
          modifiers={[padding(16, 4, 16, 0)]}
        >
          {t("notes.photoHint", {
            count: existingFotos.length + pendingPhotos.length,
          })}
        </M3Text>

        {editorError ? (
          <M3Text
            variant="caption"
            color="error"
            modifiers={[padding(16, 2, 16, 0)]}
          >
            {editorError}
          </M3Text>
        ) : null}
      </BottomSheet>

      <Modal
        visible={lightbox !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={() => setLightbox(null)}
            hitSlop={10}
            style={{
              position: "absolute",
              top: insets.top + 10,
              right: insets.right + 16,
              zIndex: 2,
            }}
          >
            <M3Host matchContents>
              <SymbolIcon name="close" size={28} tint="#ffffff" label={t("common.close")} />
            </M3Host>
          </Pressable>
          {lightbox ? (
            <Image
              source={{ uri: lightbox }}
              style={{ width: "100%", height: "80%" }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}
