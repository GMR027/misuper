-- 036_add_caldo_pollo_liquido.sql
-- El catálogo tenía "Caldo de pollo en polvo" y "Consomé de pollo", pero no
-- caldo de pollo líquido, que es como lo usan decenas de recetas (ml/L).
-- Se agrega con su dato nutricional orientativo.

INSERT INTO productos (nombre, categoria_id, unidad_base, estado, created_at, updated_at)
SELECT 'Caldo de pollo', c.id, 'L', 'activo', NOW(), NOW()
FROM categorias c
WHERE c.nombre = 'Otros'
  AND NOT EXISTS (
      SELECT 1
      FROM (SELECT id FROM productos WHERE nombre = 'Caldo de pollo' AND usuario_id IS NULL) AS existente
  );

UPDATE productos
SET kcal_100 = 15,
    peso_pieza_g = 1000,
    fuente_nutricion = 'Tabla de composición (aprox.)'
WHERE nombre = 'Caldo de pollo'
  AND usuario_id IS NULL;
