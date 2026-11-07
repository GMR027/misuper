-- 032_add_fuente_recetas.sql
-- Atribución de recetas de referencia: nombre de la fuente, enlace a la
-- receta original y autor original. Permite mostrar en el recetario que la
-- receta no es propia de Misuper.

ALTER TABLE recetas
    ADD COLUMN fuente_nombre VARCHAR(150) NULL AFTER imagen_url,
    ADD COLUMN fuente_url VARCHAR(500) NULL AFTER fuente_nombre,
    ADD COLUMN fuente_autor VARCHAR(150) NULL AFTER fuente_url,
    ADD KEY idx_recetas_fuente_url (fuente_url);
