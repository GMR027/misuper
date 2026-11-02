<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Ticket de compra subido por un usuario.
 *
 * La fila guarda la ruta pública de la imagen, el texto que devolvió OCR y,
 * cuando el usuario confirma la revisión, la compra generada.
 */
final class Ticket
{
    public function __construct(
        public readonly int $id,
        public readonly int $usuarioId,
        public readonly ?int $compraId,
        public readonly string $ruta,
        public readonly ?string $textoOcr,
        public readonly ?string $totalDetectado,
        public readonly string $estado,
        public readonly ?string $createdAt = null,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) $row['id'],
            usuarioId: (int) $row['usuario_id'],
            compraId: isset($row['compra_id']) ? (int) $row['compra_id'] : null,
            ruta: (string) $row['ruta'],
            textoOcr: isset($row['texto_ocr']) ? (string) $row['texto_ocr'] : null,
            totalDetectado: isset($row['total_detectado'])
                ? (string) $row['total_detectado']
                : null,
            estado: (string) $row['estado'],
            createdAt: isset($row['created_at']) ? (string) $row['created_at'] : null,
        );
    }

    /**
     * @return array{id: int, compra_id: int|null, estado: string, total_detectado: float|null, created_at: string|null}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'compra_id' => $this->compraId,
            'estado' => $this->estado,
            'total_detectado' => $this->totalDetectado === null
                ? null
                : round((float) $this->totalDetectado, 2),
            'created_at' => $this->createdAt,
        ];
    }
}
