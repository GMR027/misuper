-- 015_add_imagen_estado_productos.sql
-- Estado de verificación de la imagen remota del producto.
-- NULL = pendiente de verificar; 'ok' = responde; 'vencida' = URL rota.
-- La creación de categorías desde el panel Admin no requiere cambios de
-- esquema: usa la tabla existente.

ALTER TABLE productos
    ADD COLUMN imagen_estado ENUM('ok', 'vencida') NULL AFTER imagen_url,
    ADD COLUMN imagen_verificada_at DATETIME NULL AFTER imagen_estado,
    ADD KEY idx_productos_imagen_estado (imagen_estado);
