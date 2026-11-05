-- 024_add_tipos_dietas.sql
-- Agrega las dietas mediterránea, DASH, baja en carbohidratos y keto.
-- Restaura 'diabetico' porque las recetas base ya lo usan y en el clúster
-- la etiqueta había quedado huérfana.

INSERT INTO tipos_recetas (slug, nombre, descripcion, icono, aviso) VALUES
('diabetico', 'Apto para diabéticos', 'Opciones sin azúcar añadida y con ingredientes de bajo impacto glucémico.', 'bi-heart-pulse', 'Esta etiqueta es orientativa. No sustituye la valoración de tu médico o nutriólogo; revisa porciones y carbohidratos según tu plan.'),
('mediterranea', 'Dieta mediterránea', 'Recetas con aceite de oliva, pescado, legumbres, verduras y granos integrales.', 'bi-sun', 'Etiqueta orientativa. Ajusta porciones y alimentos según tu plan nutricional.'),
('dash', 'Dieta DASH', 'Opciones bajas en sodio, con verduras, frutas, proteínas magras y granos integrales.', 'bi-heart-pulse', 'Etiqueta orientativa. Si sigues DASH por hipertensión, revisa el sodio de los productos envasados y consulta a tu médico.'),
('baja_carbohidratos', 'Baja en carbohidratos', 'Recetas con menos carbohidratos y más proteína, verduras y grasas saludables.', 'bi-egg', 'Etiqueta orientativa. No sustituye la valoración de tu médico o nutriólogo.'),
('keto', 'Keto', 'Recetas altas en grasas saludables y muy bajas en carbohidratos.', 'bi-fire', 'Etiqueta orientativa. La dieta keto debe supervisarse por un profesional de la salud, especialmente si tienes alguna condición médica.')
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    descripcion = VALUES(descripcion),
    icono = VALUES(icono),
    aviso = VALUES(aviso);
