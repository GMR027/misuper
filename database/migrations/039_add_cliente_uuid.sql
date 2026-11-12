-- 039_add_cliente_uuid.sql
-- Reintentos idempotentes desde la app móvil.
--
-- El cliente genera un UUID por operación y lo reenvía si la respuesta se
-- perdió (la señal del súper se corta). El índice único por usuario hace que
-- el segundo intento devuelva la fila existente en vez de duplicarla.
--
-- cliente_uuid NULL = operación creada desde la web o antes de este cambio;
-- MySQL permite varios NULL en un índice único.

ALTER TABLE compras
    ADD COLUMN cliente_uuid CHAR(36) NULL AFTER usuario_id,
    ADD UNIQUE KEY uq_compras_cliente_uuid (usuario_id, cliente_uuid);

ALTER TABLE tickets
    ADD COLUMN cliente_uuid CHAR(36) NULL AFTER usuario_id,
    ADD UNIQUE KEY uq_tickets_cliente_uuid (usuario_id, cliente_uuid);
