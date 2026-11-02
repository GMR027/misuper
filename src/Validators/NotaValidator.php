<?php

declare(strict_types=1);

namespace App\Validators;

/**
 * Validación server-side de las notas personales.
 */
final class NotaValidator
{
    public const TITULO_MAX = 150;
    public const CONTENIDO_MAX = 10000;

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function datos(array $data): array
    {
        $errors = [];
        $titulo = $data['titulo'] ?? null;
        $contenido = $data['contenido'] ?? '';

        if (!is_string($titulo) || mb_strlen(trim($titulo)) < 2) {
            $errors['titulo'] = 'El título debe tener al menos 2 caracteres.';
        } elseif (mb_strlen(trim($titulo)) > self::TITULO_MAX) {
            $errors['titulo'] = 'El título debe tener como máximo ' . self::TITULO_MAX . ' caracteres.';
        }

        if (!is_string($contenido)) {
            $errors['contenido'] = 'El contenido no es válido.';
        } elseif (mb_strlen($contenido) > self::CONTENIDO_MAX) {
            $errors['contenido'] = 'El contenido debe tener como máximo ' . self::CONTENIDO_MAX . ' caracteres.';
        }

        return $errors;
    }
}
