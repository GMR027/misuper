import { invoke } from "@tauri-apps/api/core";

export type AppState = {
  configured: boolean;
  server_url: string | null;
  zoom: number;
  settings: boolean;
  local_url: string;
};

export type Proveedor = "ollama" | "opencode" | "claude";

export type ResultadoPrueba = {
  ok: boolean;
  mensaje: string;
  detalle: string | null;
  latencia_ms: number | null;
  fecha_ms: number;
};

export type Recomendacion = {
  nivel: string;
  etiqueta: string;
  detalle: string;
  memoria_estimada_bytes: number | null;
};

export type GpuInfo = {
  nombre: string;
  vram_total_bytes: number | null;
  vram_libre_bytes: number | null;
  integrada: boolean;
};

export type HardwareInfo = {
  cpu: string;
  nucleos: number;
  ram_total_bytes: number;
  ram_disponible_bytes: number;
  gpu: GpuInfo | null;
};

export type ConexionIa = {
  id: string;
  nombre: string;
  proveedor: Proveedor;
  modelo: string;
  endpoint: string | null;
  comando: string | null;
  tamano_bytes: number | null;
  parametros: string | null;
  cuantizacion: string | null;
  capacidades: string[];
  gratis: boolean;
  ultima_prueba: ResultadoPrueba | null;
  creada_ms: number;
  activa: boolean;
  recomendacion: Recomendacion | null;
};

export type EstadoInsignia = {
  visible: boolean;
  estado: string;
  proveedor: string | null;
  modelo: string | null;
  detalle: string | null;
};

export type IaResumen = {
  conexiones: ConexionIa[];
  activa: string | null;
  hardware: HardwareInfo;
  estado_insignia: EstadoInsignia;
};

export type ModeloDisponible = {
  id: string;
  nombre: string;
  proveedor: Proveedor;
  tamano_bytes: number | null;
  parametros: string | null;
  cuantizacion: string | null;
  capacidades: string[];
  gratis: boolean;
  recomendacion: Recomendacion | null;
};

export type DeteccionProveedor = {
  proveedor: Proveedor;
  instalado: boolean;
  disponible: boolean;
  autenticado: boolean | null;
  version: string | null;
  detalle: string | null;
  endpoint: string | null;
  modelos: ModeloDisponible[];
};

export type DeteccionIa = {
  hardware: HardwareInfo;
  ollama: DeteccionProveedor;
  opencode: DeteccionProveedor;
  claude: DeteccionProveedor;
};

export type Sesion = {
  autenticado: boolean;
  admin: boolean;
  nombre: string | null;
  email: string | null;
  rol: string | null;
};

export type RecetaCandidata = {
  id: number;
  titulo: string;
  pagina_inicio: number;
  pagina_fin: number;
  confianza: number;
  estado: "lista" | "dudosa" | "descartada" | string;
  motivo: string | null;
  ingredientes_detectados: number;
  pasos_detectados: number;
  lineas: number;
  vista_previa: string;
  texto: string;
};

export type AnalisisPdf = {
  archivo: string;
  nombre: string;
  paginas: number;
  caracteres: number;
  candidatas: RecetaCandidata[];
  avisos: string[];
};

export type NuevaConexion = {
  id?: string | null;
  nombre: string;
  proveedor: Proveedor;
  modelo: string;
  endpoint?: string | null;
  comando?: string | null;
  tamano_bytes?: number | null;
  parametros?: string | null;
  cuantizacion?: string | null;
  capacidades?: string[];
  gratis?: boolean;
};

export const api = {
  state: () => invoke<AppState>("app_state"),
  guardarServidor: (server: string) =>
    invoke<AppState>("guardar_servidor", { server }),
  abrirAjustes: () => invoke<void>("abrir_ajustes"),
  abrirAjustesIa: () => invoke<void>("abrir_ajustes_ia"),
  volverWeb: () => invoke<void>("volver_web"),
  aplicarZoom: (zoom: number) => invoke<number>("aplicar_zoom", { zoom }),

  sesionActual: () => invoke<Sesion>("sesion_actual"),
  iaEstado: () => invoke<IaResumen>("ia_estado"),
  iaDetectar: () => invoke<DeteccionIa>("ia_detectar"),
  iaGuardar: (datos: NuevaConexion) =>
    invoke<IaResumen>("ia_guardar_conexion", { datos }),
  iaEliminar: (id: string) =>
    invoke<IaResumen>("ia_eliminar_conexion", { id }),
  iaActivar: (id: string) => invoke<IaResumen>("ia_activar", { id }),
  iaProbar: (id: string) => invoke<IaResumen>("ia_probar", { id }),

  importarAnalizarPdf: (ruta: string) =>
    invoke<AnalisisPdf>("importar_analizar_pdf", { ruta }),
  abrirChef: () => invoke<void>("abrir_chef"),
};

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}

export function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatearBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";

  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) return `${gib.toFixed(1)} GB`;

  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function fechaCorta(ms: number | null | undefined): string {
  if (!ms) return "nunca";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ms));
}
