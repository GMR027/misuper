-- 037_create_api_tokens.sql
-- Tokens de acceso para la app Android. Se guarda solo el hash SHA-256 del
-- token; el valor real se entrega una vez al iniciar sesión. Cada teléfono o
-- instalación tiene su propio token y puede revocarse sin afectar a los demás.

CREATE TABLE IF NOT EXISTS api_tokens (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    device_name VARCHAR(120) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_api_tokens_hash (token_hash),
    KEY idx_api_tokens_usuario (usuario_id),
    KEY idx_api_tokens_expira (expires_at),
    CONSTRAINT fk_api_tokens_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
