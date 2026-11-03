-- 014_drop_sugerencias_producto.sql
-- Se elimina el sistema de sugerencias: los productos manuales ahora son
-- propios del usuario que los crea y no requieren aprobación del Admin.

DROP TABLE IF EXISTS sugerencias_producto;
