-- 022_create_categorias_recetas.sql
-- Categoría de platillo (bebidas, guisados, ensaladas…) separada de los
-- tipos de dieta (vegetariano, sin gluten…). Una receta tiene una categoría.

CREATE TABLE IF NOT EXISTS categorias_recetas (
    id INT NOT NULL AUTO_INCREMENT,
    slug VARCHAR(80) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    icono VARCHAR(80) NOT NULL DEFAULT 'bi-tag',
    orden SMALLINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categorias_recetas_slug (slug),
    KEY idx_categorias_recetas_orden (orden, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO categorias_recetas (slug, nombre, descripcion, icono, orden)
VALUES
    ('bebidas', 'Bebidas', 'Aguas, licuados, smoothies, café y té.', 'bi-cup-straw', 1),
    ('desayunos', 'Desayunos', 'Huevos, hotcakes, molletes, avena y pan dulce.', 'bi-sunrise', 2),
    ('ensaladas', 'Ensaladas', 'Frescas, con proteína o de fruta.', 'bi-flower2', 3),
    ('sopas', 'Sopas y caldos', 'Caldos, cremas y sopas de pasta.', 'bi-cup-hot', 4),
    ('guisados', 'Guisados', 'Platillos con salsa, carne o verduras.', 'bi-fire', 5),
    ('platos-fuertes', 'Platos fuertes', 'Carnes, aves y pescados como plato principal.', 'bi-egg-fried', 6),
    ('pastas', 'Pastas', 'Espagueti, pasta corta y salsas.', 'bi-basket3', 7),
    ('complementos', 'Complementos', 'Guarniciones, salsas, dips y acompañamientos.', 'bi-basket', 8),
    ('antojitos', 'Antojitos', 'Tacos, tostadas, quesadillas, tortas y sándwiches.', 'bi-basket2', 9),
    ('postres', 'Postres', 'Dulces, frutas preparadas y postres caseros.', 'bi-cake2', 10)
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    descripcion = VALUES(descripcion),
    icono = VALUES(icono),
    orden = VALUES(orden);

ALTER TABLE recetas
    ADD COLUMN categoria_id INT NULL AFTER tipos,
    ADD KEY idx_recetas_categoria (categoria_id),
    ADD CONSTRAINT fk_recetas_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias_recetas (id)
        ON DELETE RESTRICT;

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'bebidas'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'agua-de-limon', 'agua-de-naranja', 'agua-de-pepino-con-limon',
    'cafe-con-leche', 'chocolate-caliente', 'licuado-de-fresa',
    'licuado-de-mango', 'licuado-de-platano-y-avena',
    'smoothie-de-mango-y-espinaca', 'smoothie-verde-de-espinaca-y-pina',
    'te-verde-con-limon'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'desayunos'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'avena-con-manzana-y-canela', 'chilaquiles-rojos-con-huevo',
    'chilaquiles-verdes-con-pollo', 'hotcakes-de-avena-y-platano',
    'huevos-a-la-mexicana', 'huevos-divorciados', 'huevos-rancheros',
    'molletes-con-frijoles-y-queso', 'molletes-dulces-con-mermelada',
    'omelette-de-queso-y-espinaca', 'pan-frances-con-canela',
    'yogur-con-fresas-y-avena'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'ensaladas'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'ensalada-de-atun', 'ensalada-de-frutas', 'ensalada-de-garbanzos',
    'ensalada-de-lechuga-y-pepino', 'ensalada-de-manzana-y-lechuga',
    'ensalada-de-pollo-y-manzana'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'sopas'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'caldo-de-pollo-con-verduras', 'caldo-de-res-con-verduras',
    'crema-de-calabacita', 'sopa-de-coditos-con-verduras',
    'sopa-de-fideos-con-pollo', 'sopa-de-lentejas', 'sopa-de-tortilla',
    'sopa-de-verduras'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'guisados'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'albondigas-en-salsa-de-jitomate', 'carne-deshebrada-en-salsa-verde',
    'carne-molida-con-ejotes', 'chiles-rellenos-de-queso',
    'costillas-de-res-guisadas', 'enchiladas-verdes-de-pollo',
    'enfrijoladas', 'frijoles-charros', 'garbanzos-guisados',
    'habas-guisadas', 'picadillo-de-res-con-papa', 'pollo-en-salsa-verde',
    'tinga-de-pollo'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'platos-fuertes'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'arroz-con-pollo', 'arroz-integral-con-pollo-y-verduras',
    'bistec-con-papas', 'bistec-encebollado', 'camarones-al-ajillo',
    'camaron-a-la-plancha-con-limon', 'carne-con-brocoli',
    'chuletas-de-cerdo-a-la-naranja', 'lomo-de-cerdo-con-manzana',
    'milanesas-de-res-empanizadas', 'pescado-a-la-veracruzana',
    'pescado-al-horno-con-verduras', 'pescado-tilapia-al-ajillo',
    'pollo-a-la-naranja', 'pollo-a-la-plancha-con-ensalada',
    'pollo-al-limon', 'pollo-con-brocoli', 'pollo-con-papas-al-horno',
    'pollo-entero-al-horno', 'tortitas-de-atun'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'pastas'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'espagueti-a-la-bolonesa', 'espagueti-con-atun-y-tomate',
    'pasta-con-verduras'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'complementos'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'arroz-con-verduras', 'arroz-integral-con-verduras', 'arroz-rojo',
    'calabacitas-con-jitomate', 'ejotes-con-huevo', 'frijoles-de-la-olla',
    'guacamole', 'hummus-de-garbanzo', 'papas-a-la-francesa',
    'pure-de-papa', 'pure-de-zanahoria', 'salsa-mexicana',
    'tortitas-de-papa-con-queso', 'yogur-griego-con-pepino'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'antojitos'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'hamburguesas-caseras', 'quesadillas-de-queso-y-rajas',
    'sincronizadas', 'sandwich-de-atun', 'tacos-de-carne-molida',
    'tacos-de-huevo-y-espinaca', 'tacos-de-pescado',
    'tortas-de-jamon-y-queso', 'tostadas-de-frijoles-y-queso',
    'tostadas-de-tinga'
);

UPDATE recetas r
INNER JOIN categorias_recetas c ON c.slug = 'postres'
SET r.categoria_id = c.id
WHERE r.slug IN (
    'arroz-con-leche', 'fresas-con-crema', 'platanos-fritos'
);
