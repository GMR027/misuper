-- 009_create_nota_fotos.sql
-- Fotos adjuntas a una nota. Se guardan en public/uploads/notas y se
-- eliminan en cascada al borrar la nota.

CREATE TABLE IF NOT EXISTS nota_fotos (
    id INT NOT NULL AUTO_INCREMENT,
    nota_id INT NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_nota_fotos_nota (nota_id),
    CONSTRAINT fk_nota_fotos_nota
        FOREIGN KEY (nota_id) REFERENCES notas (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
