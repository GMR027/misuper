-- 002_admin_inicial.sql
-- Admin inicial. scripts/seed.php reemplaza __ADMIN_EMAIL__ y
-- __ADMIN_PASSWORD_HASH__ con los valores de ADMIN_EMAIL / ADMIN_PASSWORD
-- o con una contraseña temporal aleatoria si ADMIN_PASSWORD no está definida.
-- Idempotente por la clave única de email.

INSERT IGNORE INTO usuarios (nombre, email, password_hash, rol, debe_cambiar_password)
VALUES ('Admin', '__ADMIN_EMAIL__', '__ADMIN_PASSWORD_HASH__', 'admin', TRUE);
