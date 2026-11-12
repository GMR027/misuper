/**
 * Dictate cart items.
 *
 * Speech recognition runs on the phone when it can; nothing is uploaded for
 * transcription. The phrase is parsed into products, quantities and units and
 * shown for confirmation: nothing enters the cart without a tap.
 *
 * The parent remounts this sheet each time it opens (a new `key`), so the
 * listening state always starts clean.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Column, Row, Spacer } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button, IconButton } from "@/components/m3/buttons";
import { ChipGrid, type ChipOption } from "@/components/m3/chips";
import { Spinner } from "@/components/m3/feedback";
import { M3Text, SymbolIcon } from "@/components/m3/text";
import { useTheme } from "@/components/theme";
import { addFreeItem, addProduct } from "@/lib/cart";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { t, useLocale } from "@/lib/i18n";
import { buscarParaVoz, type CoincidenciaVoz } from "@/lib/offline/catalog";
import type { Producto } from "@/lib/products";
import { showToast } from "@/lib/toast";
import { parsearVoz } from "@/lib/voice/parse";

type Fase = "escuchando" | "procesando" | "confirmar" | "sin-resultado";

interface Linea {
  key: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  precio: number | null;
  producto: Producto | null;
  candidatos: CoincidenciaVoz[];
  ambiguo: boolean;
}

export function VoiceCartSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  useLocale();
  const { colors } = useTheme();
  const [fase, setFase] = useState<Fase>("escuchando");
  const [transcripcion, setTranscripcion] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enDispositivo, setEnDispositivo] = useState(true);
  const finalRef = useRef(false);
  const secuenciaRef = useRef(0);
  const claveRef = useRef(1);
  const transcripcionRef = useRef("");
  const soloDispositivoRef = useRef(false);

  const cambiarFase = useCallback((siguiente: Fase) => {
    setFase(siguiente);
  }, []);

  const procesar = useCallback(
    async (texto: string) => {
      const secuencia = ++secuenciaRef.current;
      cambiarFase("procesando");

      const items = parsearVoz(texto);

      if (items.length === 0) {
        setError(t("voice.notUnderstood"));
        cambiarFase("sin-resultado");
        return;
      }

      const nuevas = await Promise.all(
        items.map(async (item): Promise<Linea> => {
          const candidatos = await buscarParaVoz(item.nombre);
          const primero = candidatos[0];
          const ambiguo =
            candidatos.length > 1 &&
            candidatos[1].puntaje >= (primero?.puntaje ?? 0) - 0.08;
          const producto = ambiguo ? null : (primero?.producto ?? null);

          return {
            key: claveRef.current++,
            nombre: producto?.nombre ?? item.nombre,
            cantidad: item.cantidad ?? 1,
            unidad: item.unidad ?? producto?.unidad_base ?? "pza",
            precio: item.precio,
            producto,
            candidatos,
            ambiguo,
          };
        }),
      );

      if (secuencia !== secuenciaRef.current) return;

      setLineas(nuevas);
      cambiarFase("confirmar");
    },
    [cambiarFase],
  );

  const iniciar = useCallback(
    async (preferirDispositivo = true) => {
      const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permiso.granted) {
        setError(t("voice.permissionDenied"));
        cambiarFase("sin-resultado");
        return;
      }

      let soporta = false;

      try {
        soporta = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      } catch {
        soporta = false;
      }

      setEnDispositivo(soporta);

      const soloDispositivo = preferirDispositivo && soporta;
      soloDispositivoRef.current = soloDispositivo;

      try {
        ExpoSpeechRecognitionModule.start({
          // The catalog is in Spanish, so dictation is always Spanish.
          lang: "es-MX",
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: soloDispositivo,
          addsPunctuation: false,
        });
      } catch {
        setError(t("voice.unavailable"));
        cambiarFase("sin-resultado");
      }
    },
    [cambiarFase],
  );

  useSpeechRecognitionEvent("result", (evento) => {
    const texto = evento.results[0]?.transcript?.trim() ?? "";

    if (texto === "") return;

    transcripcionRef.current = texto;
    setTranscripcion(texto);

    if (evento.isFinal && !finalRef.current) {
      finalRef.current = true;
      void procesar(texto);
    }
  });

  useSpeechRecognitionEvent("error", (evento) => {
    if (finalRef.current || evento.error === "aborted") return;

    // The phone supports on-device recognition but lacks the Spanish pack:
    // retry once through the system's online recognizer.
    if (
      soloDispositivoRef.current &&
      (evento.error === "language-not-supported" ||
        evento.error === "service-not-allowed")
    ) {
      soloDispositivoRef.current = false;
      setEnDispositivo(false);
      finalRef.current = true;

      setTimeout(() => {
        finalRef.current = false;
        void iniciar(false);
      }, 300);

      return;
    }

    finalRef.current = true;
    setError(
      evento.error === "no-speech"
        ? t("voice.notUnderstood")
        : evento.error === "not-allowed" || evento.error === "service-not-allowed"
          ? t("voice.permissionDenied")
          : t("voice.error"),
    );
    cambiarFase("sin-resultado");
  });

  useSpeechRecognitionEvent("end", () => {
    if (finalRef.current) return;

    finalRef.current = true;
    const texto = transcripcionRef.current;

    if (texto !== "") {
      void procesar(texto);
    } else {
      setError(t("voice.notUnderstood"));
      cambiarFase("sin-resultado");
    }
  });

  useEffect(() => {
    if (!visible) return;

    // Give the sheet a moment to appear before the microphone starts.
    const timer = setTimeout(() => {
      void iniciar();
    }, 150);

    return () => {
      clearTimeout(timer);

      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Nothing was listening.
      }
    };
  }, [visible, iniciar]);

  const reintentar = () => {
    finalRef.current = false;
    transcripcionRef.current = "";
    setTranscripcion("");
    setLineas([]);
    setError(null);
    cambiarFase("escuchando");
    void iniciar();
  };

  const elegir = (key: number, producto: Producto) => {
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.key === key
          ? {
              ...linea,
              producto,
              nombre: producto.nombre,
              unidad: producto.unidad_base,
            }
          : linea,
      ),
    );
  };

  const quitar = (key: number) => {
    setLineas((actuales) => actuales.filter((linea) => linea.key !== key));
  };

  const agregar = () => {
    let agregados = 0;

    for (const linea of lineas) {
      if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) continue;
      if (linea.nombre.trim() === "") continue;

      const precio = linea.precio ?? 0;

      if (precio < 0) continue;

      const entro =
        linea.producto !== null && linea.nombre === linea.producto.nombre
          ? addProduct(linea.producto, {
              cantidad: linea.cantidad,
              precio_total: precio,
            })
          : addFreeItem({
              nombre: linea.nombre.trim(),
              unidad_base: linea.unidad,
              cantidad: linea.cantidad,
              precio_total: precio,
            });

      if (entro) agregados += 1;
    }

    if (agregados === 0) {
      setError(t("voice.nothingToAdd"));
      return;
    }

    showToast(t("voice.added", { count: agregados }), "success");
    onClose();
  };

  const opciones = (linea: Linea): ChipOption<number | null>[] =>
    linea.candidatos.map((candidato) => ({
      value: candidato.producto.id,
      label: candidato.producto.nombre,
    }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("voice.title")}
      footer={
        fase === "confirmar" ? (
          <Button
            label={t("voice.addItems")}
            icon="add"
            onPress={agregar}
            disabled={lineas.length === 0}
          />
        ) : fase === "sin-resultado" ? (
          <Button
            label={t("voice.retry")}
            icon="refresh"
            onPress={reintentar}
          />
        ) : undefined
      }
    >
      {fase === "escuchando" || fase === "procesando" ? (
        <Column
          horizontalAlignment="center"
          modifiers={[fillMaxWidth(), padding(24, 24, 24, 16)]}
        >
          {fase === "procesando" ? (
            <Spinner />
          ) : (
            <SymbolIcon
              name="mic"
              size={44}
              tint={colors.accent}
              label={t("voice.listening")}
            />
          )}
          <Spacer modifiers={[height(12)]} />
          <M3Text variant="subtitle">
            {fase === "procesando" ? t("voice.parsing") : t("voice.listening")}
          </M3Text>
          <Spacer modifiers={[height(6)]} />
          <M3Text variant="body" color="muted">
            {transcripcion === "" ? t("voice.example") : `“${transcripcion}”`}
          </M3Text>
          {fase === "escuchando" && !enDispositivo ? (
            <>
              <Spacer modifiers={[height(10)]} />
              <M3Text variant="caption" color="muted">
                {t("voice.onlineFallback")}
              </M3Text>
            </>
          ) : null}
        </Column>
      ) : null}

      {fase === "sin-resultado" ? (
        <Column modifiers={[fillMaxWidth(), padding(24, 24, 24, 16)]}>
          <M3Text variant="body" color="error">
            {error ?? t("voice.notUnderstood")}
          </M3Text>
          <Spacer modifiers={[height(8)]} />
          <M3Text variant="caption" color="muted">
            {t("voice.example")}
          </M3Text>
        </Column>
      ) : null}

      {fase === "confirmar" ? (
        <Column modifiers={[fillMaxWidth()]}>
          {lineas.map((linea) => (
            <Column
              key={linea.key}
              modifiers={[fillMaxWidth(), padding(24, 10, 24, 10)]}
            >
              <Row verticalAlignment="center">
                <Column modifiers={[weight(1)]}>
                  <M3Text variant="body" weight="600">
                    {linea.nombre}
                  </M3Text>
                  <M3Text variant="caption" color="muted">
                    {[
                      `${formatQuantity(linea.cantidad)} ${linea.unidad}`,
                      linea.precio !== null
                        ? formatCurrency(linea.precio)
                        : t("voice.noPrice"),
                      linea.producto === null ? t("voice.freeItem") : null,
                    ]
                      .filter((parte) => parte !== null)
                      .join(" · ")}
                  </M3Text>
                </Column>
                <IconButton
                  icon="delete"
                  label={t("voice.remove")}
                  variant="standard"
                  color={colors.error}
                  onPress={() => quitar(linea.key)}
                  size={36}
                  iconSize={20}
                />
              </Row>

              {linea.ambiguo && linea.candidatos.length > 0 ? (
                <>
                  <Spacer modifiers={[height(8)]} />
                  <M3Text variant="caption" color="muted">
                    {t("voice.pickProduct")}
                  </M3Text>
                  <Spacer modifiers={[height(6)]} />
                  <ChipGrid<number | null>
                    options={opciones(linea)}
                    value={linea.producto?.id ?? null}
                    onChange={(id) => {
                      const elegido = linea.candidatos.find(
                        (candidato) => candidato.producto.id === id,
                      );

                      if (elegido !== undefined) {
                        elegir(linea.key, elegido.producto);
                      }
                    }}
                  />
                </>
              ) : null}
            </Column>
          ))}

          <Column modifiers={[fillMaxWidth(), padding(24, 4, 24, 16)]}>
            <M3Text variant="caption" color="muted">
              {t("voice.priceHint")}
            </M3Text>
          </Column>
        </Column>
      ) : null}
    </BottomSheet>
  );
}
