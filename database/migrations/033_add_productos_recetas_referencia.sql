-- 033_add_productos_recetas_referencia.sql
-- Agrega al catálogo global los ingredientes de las 1,004 recetas de
-- referencia que todavía no existían como producto.
--
-- - No asocia imágenes: imagen_url queda NULL para completarlas después.
-- - Unidades: kg/gr para peso, L/ml para volumen y pza para piezas o
--   envases. Se eligió la unidad habitual de compra y la que mejor
--   convierte con las cantidades de las recetas.
-- - Idempotente: no inserta un nombre que ya exista en el catálogo global.

INSERT INTO productos (nombre, categoria_id, unidad_base, estado, created_at, updated_at)
SELECT v.nombre, c.id, v.unidad_base, 'activo', NOW(), NOW()
FROM (
    SELECT 'Tomate cherry' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Tomatillo' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Lima' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Rábano' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Puerro' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Apio' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Calabaza' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Camote' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Elote' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Granos de elote' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Nopal' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Huitlacoche' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Champiñón' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Repollo' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Acelga' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Remolacha' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chícharo' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Berenjena' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Espárrago' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Jengibre' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Tamarindo' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Flor de jamaica' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Guayaba' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Granada' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Pimiento rojo' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Pimiento verde' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Pimiento morrón' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Hoja de plátano' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Hoja de maíz' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Flor de calabaza' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Chalota' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Canónigo' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Maracuyá' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile serrano' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile guajillo' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile ancho' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile pasilla' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile morita' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile chipotle' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile de árbol' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile habanero' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile mulato' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile piquín' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile cuaresmeño' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chiles en vinagre' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Pulpo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Langostino' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Gamba' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Lubina' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Corvina' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pescado blanco' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Bacalao' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Salmón' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Arrachera' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Espaldilla de res' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Aguja de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pierna de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Codillo de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Solomillo de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Solomillo de res' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Costilla de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chicharrón' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pechuga de pavo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Conejo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Cordero' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Ostra' AS nombre, 'Carnes' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Jaiba' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Hueso de res' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Nata espesa' AS nombre, 'Lácteos' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Crème fraîche' AS nombre, 'Lácteos' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Queso cotija' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso feta' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso mozzarella' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso gouda' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso de cabra' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso para gratinar' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso chihuahua' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso emmental' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Leche de coco' AS nombre, 'Lácteos' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Masa de maíz' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Masa para tortillas' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Tostadas de maíz' AS nombre, 'Cereales y Legumbres' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Totopos' AS nombre, 'Cereales y Legumbres' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Fideos' AS nombre, 'Cereales y Legumbres' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Arroz largo' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pan rallado' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Galletas María' AS nombre, 'Cereales y Legumbres' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Maicena' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Polvo para hornear' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Levadura química' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Levadura instantánea' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Bicarbonato' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Quinoa' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Cuscús' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Almendra' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Nuez' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Piñón' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Cacahuate' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Semillas de calabaza' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Semillas de chía' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Sésamo' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Amaranto' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pasas' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Ciruela pasa' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Coco rallado' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Mezcal' AS nombre, 'Bebidas' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Tequila' AS nombre, 'Bebidas' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Jerez seco' AS nombre, 'Bebidas' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Agua con gas' AS nombre, 'Bebidas' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Clamato' AS nombre, 'Bebidas' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Sal de mar' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Sal fina' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Sal gruesa' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Sal Maldon' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pimienta negra' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Pimienta blanca' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Pimienta gorda' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Orégano' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Laurel' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Comino' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Tomillo' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Mejorana' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Romero' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Salvia' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Canela en rama' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Canela molida' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Clavo de olor' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Nuez moscada' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Anís estrella' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Pimentón' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Azafrán' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Cúrcuma' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Achiote en pasta' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Chipotle adobado' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Salsa inglesa' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Salsa Maggi' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Salsa de soya' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Salsa Perrins' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Salsa Tabasco' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Salsa Valentina' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Vinagre de manzana' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Vinagre de caña' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Vinagre balsámico' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Vinagre de arroz' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Vinagre de Jerez' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Aceite de girasol' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Aceite de maíz' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Aceite de sésamo' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Aceite de coco' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Manteca de cerdo' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Manteca vegetal' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Alcaparras' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Aceitunas' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Miel de agave' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Piloncillo' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Azúcar glass' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Vainilla' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Consomé de pollo' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Caldo de verduras' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Caldo de pescado' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Caldo de carne' AS nombre, 'Otros' AS categoria, 'L' AS unidad_base
    UNION ALL SELECT 'Sazonador de pollo' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Recado negro' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Tajín' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Chile en polvo' AS nombre, 'Otros' AS categoria, 'gr' AS unidad_base
    UNION ALL SELECT 'Hielo' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Cacao en polvo' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Grenetina' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Perejil' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Epazote' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Hierbabuena' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Menta' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Hoja santa' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Cebolleta' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Cebollino' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Maíz amarillo' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Cebolla dulce' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Cebolla roja' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Maíz dulce' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Chile verde' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile cascabel' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Ñora' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Manzana golden' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Atún fresco' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Pato' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Ostión' AS nombre, 'Carnes' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Lenguado' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Queso cheddar' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Sal de grano' AS nombre, 'Otros' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Salsa roja' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Salsa verde' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Pastilla de caldo' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Recado rojo' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Crepas' AS nombre, 'Cereales y Legumbres' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Jalapeños en vinagre' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Paleta de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Lomo de res' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Bistec de cerdo' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Carne seca' AS nombre, 'Carnes' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Alubia blanca' AS nombre, 'Cereales y Legumbres' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Chile güero' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Guindilla' AS nombre, 'Frutas y Verduras' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Maíz blanco' AS nombre, 'Frutas y Verduras' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Queso holandés' AS nombre, 'Lácteos' AS categoria, 'kg' AS unidad_base
    UNION ALL SELECT 'Cajeta' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Crutones' AS nombre, 'Otros' AS categoria, 'pza' AS unidad_base
    UNION ALL SELECT 'Baguette' AS nombre, 'Cereales y Legumbres' AS categoria, 'pza' AS unidad_base
) AS v
INNER JOIN categorias c ON c.nombre = v.categoria
WHERE NOT EXISTS (
    SELECT 1
    FROM productos p
    WHERE p.usuario_id IS NULL
      AND LOWER(p.nombre) = LOWER(v.nombre)
);
