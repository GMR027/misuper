fn main() {
    let manifest = tauri_build::AppManifest::new().commands(&[
        "app_state",
        "guardar_servidor",
        "abrir_ajustes",
        "abrir_ajustes_ia",
        "volver_web",
        "aplicar_zoom",
        "sesion_actual",
        "ia_estado",
        "ia_detectar",
        "ia_guardar_conexion",
        "ia_eliminar_conexion",
        "ia_activar",
        "ia_probar",
        "importar_analizar_pdf",
        "importar_elegir_pdf",
        "importar_titulo_vision",
        "importar_extraer_receta",
        "abrir_chef",
    ]);

    let attributes = tauri_build::Attributes::new().app_manifest(manifest);
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
