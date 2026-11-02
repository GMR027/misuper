-- 010_add_unidades_gr_ml.sql
-- Amplía las unidades base del catálogo con gramos (gr) y mililitros (ml).

ALTER TABLE productos
    MODIFY COLUMN unidad_base ENUM('kg', 'L', 'pza', 'gr', 'ml') NOT NULL;
