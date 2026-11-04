-- 020_create_tipos_recetas_e_imagen.sql
-- Tipos de receta editables desde el Admin e imagen de portada de la tarjeta.

CREATE TABLE IF NOT EXISTS tipos_recetas (
    id INT NOT NULL AUTO_INCREMENT,
    slug VARCHAR(80) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    icono VARCHAR(80) NOT NULL DEFAULT 'bi-tag',
    aviso VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tipos_recetas_slug (slug),
    KEY idx_tipos_recetas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO tipos_recetas (slug, nombre, descripcion, icono, aviso)
VALUES
    ('general', 'General', 'Recetas caseras para cualquier ocasión.', 'bi-egg-fried', ''),
    ('diabetico', 'Apto para diabéticos', 'Opciones sin azúcar añadida y con ingredientes de bajo impacto glucémico.', 'bi-heart-pulse', 'Esta etiqueta es orientativa. No sustituye la valoración de tu médico o nutriólogo; revisa porciones y carbohidratos según tu plan.'),
    ('kosher', 'Kosher', 'Recetas sin cerdo ni mariscos y sin mezclar carne con lácteos.', 'bi-star-of-david', 'Etiqueta orientativa de estilo kosher. No es una certificación rabínica; verifica ingredientes, certificaciones y utensilios si sigues una dieta kosher estricta.'),
    ('vegetariano', 'Vegetariano', 'Sin carne ni pescado.', 'bi-flower1', ''),
    ('sin_gluten', 'Sin gluten', 'Recetas elaboradas sin trigo ni pasta.', 'bi-shield-check', 'Revisa las etiquetas de los productos envasados y evita la contaminación cruzada si tienes enfermedad celíaca.')
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    descripcion = VALUES(descripcion),
    icono = VALUES(icono),
    aviso = VALUES(aviso);

ALTER TABLE recetas
    ADD COLUMN imagen_url VARCHAR(500) NULL AFTER pasos;
