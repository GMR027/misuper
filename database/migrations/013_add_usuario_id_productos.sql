-- 013_add_usuario_id_productos.sql
-- Productos propios: usuario_id NULL = catálogo global; con valor = producto
-- personal, visible solo para su dueño. Al borrar la cuenta se borran sus
-- productos personales y, en cascada, los ítems de compra que los referencien.

ALTER TABLE productos
    ADD COLUMN usuario_id INT NULL AFTER categoria_id,
    ADD KEY idx_productos_usuario (usuario_id),
    ADD CONSTRAINT fk_productos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE;

ALTER TABLE compra_items
    DROP FOREIGN KEY fk_compra_items_producto;

ALTER TABLE compra_items
    ADD CONSTRAINT fk_compra_items_producto
        FOREIGN KEY (producto_id) REFERENCES productos (id)
        ON DELETE CASCADE;
