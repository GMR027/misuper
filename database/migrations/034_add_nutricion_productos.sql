-- 034_add_nutricion_productos.sql
-- Datos nutricionales orientativos por producto.
--
-- - kcal_100: kcal por 100 g en productos con unidad kg/gr/pza, o kcal por
--   100 ml en productos con unidad L/ml.
-- - peso_pieza_g: gramos (o ml aproximados en envases líquidos) por pieza.
--   Solo se usa como apoyo para convertir pza <-> g. Puede quedar NULL.
-- - fuente_nutricion: origen del dato (USDA, Open Food Facts, manual...).
--
-- NULL significa "sin dato confiable": nunca se interpreta como 0.

ALTER TABLE productos
    ADD COLUMN kcal_100 DECIMAL(7,2) NULL AFTER imagen_url,
    ADD COLUMN peso_pieza_g DECIMAL(7,2) NULL AFTER kcal_100,
    ADD COLUMN fuente_nutricion VARCHAR(120) NULL AFTER peso_pieza_g;
