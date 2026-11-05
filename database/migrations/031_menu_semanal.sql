-- 031_menu_semanal.sql
-- Menú semanal por usuario. Cada semana se guarda normalizada al lunes y
-- cada día puede tener varios platillos por tiempo de comida.

CREATE TABLE IF NOT EXISTS menus_semanales (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    semana DATE NOT NULL,
    nombre VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_menus_usuario_semana (usuario_id, semana),
    KEY idx_menus_usuario (usuario_id),
    CONSTRAINT fk_menus_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS menu_semanal_items (
    id INT NOT NULL AUTO_INCREMENT,
    menu_id INT NOT NULL,
    dia TINYINT UNSIGNED NOT NULL COMMENT '1 = lunes, 7 = domingo',
    momento ENUM('desayuno', 'comida', 'cena', 'colacion', 'otro')
        NOT NULL DEFAULT 'comida',
    tipo ENUM('receta', 'nota') NOT NULL DEFAULT 'receta',
    etiqueta VARCHAR(30) NULL COMMENT 'Nombre visible para tiempos extra',
    receta_id INT NULL,
    nombre_snapshot VARCHAR(150) NOT NULL,
    porciones TINYINT UNSIGNED NOT NULL DEFAULT 4,
    orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    nota VARCHAR(160) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_menu_items_orden (menu_id, dia, momento, orden),
    KEY idx_menu_items_receta (receta_id),
    CONSTRAINT fk_menu_items_menu
        FOREIGN KEY (menu_id) REFERENCES menus_semanales (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_menu_items_receta
        FOREIGN KEY (receta_id) REFERENCES recetas (id)
        ON DELETE SET NULL,
    CONSTRAINT chk_menu_items_dia
        CHECK (dia BETWEEN 1 AND 7),
    CONSTRAINT chk_menu_items_porciones
        CHECK (porciones BETWEEN 1 AND 50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
