-- 001_categorias.sql
-- 8 categorías fijas. Idempotente por la clave única de nombre.

INSERT IGNORE INTO categorias (nombre) VALUES
    ('Lácteos'),
    ('Carnes'),
    ('Frutas y Verduras'),
    ('Cereales y Legumbres'),
    ('Bebidas'),
    ('Limpieza'),
    ('Hogar'),
    ('Otros');
