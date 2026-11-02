-- 011_create_tickets.sql
-- Tickets de compra subidos por el usuario. Se guarda la imagen original,
-- el texto reconocido por OCR y el enlace a la compra generada al confirmar.
-- La foto se conserva en public/uploads/tickets.

CREATE TABLE IF NOT EXISTS tickets (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    compra_id INT NULL,
    ruta VARCHAR(255) NOT NULL,
    texto_ocr MEDIUMTEXT NULL,
    total_detectado DECIMAL(12,2) NULL,
    estado ENUM('procesado', 'confirmado', 'error') NOT NULL DEFAULT 'procesado',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tickets_usuario_fecha (usuario_id, created_at),
    KEY idx_tickets_compra (compra_id),
    CONSTRAINT fk_tickets_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tickets_compra
        FOREIGN KEY (compra_id) REFERENCES compras (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
