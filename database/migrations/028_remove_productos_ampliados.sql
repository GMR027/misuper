-- 028_remove_productos_ampliados.sql
-- Elimina los 66 productos agregados en la migración 025.

DELETE FROM productos
WHERE id > 200
  AND usuario_id IS NULL
  AND nombre IN (
    'Hielo', 'Jamaica', 'Tamarindo', 'Coco', 'Maracuyá', 'Menta',
    'Hierbabuena', 'Cacao en polvo', 'Endulzante sin azúcar', 'Jengibre', 'Almendra', 'Albahaca',
    'Champiñones', 'Verduras mixtas', 'Nopales', 'Arándano', 'Frijoles negros', 'Pimienta negra',
    'Canela', 'Granola', 'Pitaya', 'Salmón', 'Bagel', 'Quinoa',
    'Masa de maíz', 'Kale', 'Arúgula', 'Betabel', 'Queso feta', 'Col morada',
    'Pasas', 'Elote', 'Cuscús', 'Bulgur', 'Nuez', 'Eneldo',
    'Caldo de verduras', 'Habas', 'Mariscos mixtos', 'Fideos', 'Cebada', 'Pasta de miso',
    'Maíz pozolero', 'Panza de res', 'Carne de res', 'Calabaza', 'Acelgas', 'Chile verde',
    'Chile chipotle', 'Pasta de mole', 'Pechuga de pavo', 'Tofu firme', 'Costilla de cerdo', 'Lomo de res',
    'Penne', 'Fusilli', 'Linguini', 'Fettuccine', 'Pasta integral', 'Camote',
    'Vainilla', 'Grenetina', 'Manzana', 'Durazno', 'Calabacín', 'Pimiento morrón'
);
