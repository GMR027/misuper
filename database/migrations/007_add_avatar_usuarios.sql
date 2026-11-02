-- 007_add_avatar_usuarios.sql
-- Foto de perfil subida o avatar predefinido.
-- avatar_tipo: NULL (sin avatar), 'foto' (archivo subido) o 'preset' (catálogo).
-- avatar_valor: ruta pública de la foto o identificador del avatar predefinido.

ALTER TABLE usuarios
    ADD COLUMN avatar_tipo ENUM('foto', 'preset') NULL DEFAULT NULL AFTER email,
    ADD COLUMN avatar_valor VARCHAR(255) NULL DEFAULT NULL AFTER avatar_tipo;
