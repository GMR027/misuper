-- 012_add_titulo_tickets.sql
-- Nombre editable del ticket. Se sugiere a partir del OCR y el usuario
-- puede cambiarlo antes de confirmar la compra.

ALTER TABLE tickets
    ADD COLUMN titulo VARCHAR(150) NOT NULL DEFAULT '' AFTER compra_id;
