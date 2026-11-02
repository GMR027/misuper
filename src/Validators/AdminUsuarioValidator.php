<?php

declare(strict_types=1);

namespace App\Validators;

use App\Support\Validator;

/**
 * Validación de los parámetros y del alta/edición de usuarios del panel Admin.
 */
final class AdminUsuarioValidator
{
    public const MAX_BUSQUEDA = 150;

    public const MAX_PAGINA = 1000000;

    public const ROLES = ['usuario', 'admin'];

    /**
     * Normaliza los parámetros de la query string.
     *
     * - q: texto recortado y limitado a 150 caracteres.
     * - page: entero positivo; 1 si falta o no es válido.
     *
     * @param array<string, mixed> $query
     * @return array{q: string, page: int}
     */
    public static function listado(array $query): array
    {
        $q = '';

        if (isset($query['q']) && is_string($query['q'])) {
            $q = trim($query['q']);

            if (mb_strlen($q, 'UTF-8') > self::MAX_BUSQUEDA) {
                $q = mb_substr($q, 0, self::MAX_BUSQUEDA, 'UTF-8');
            }
        }

        $page = 1;

        if (isset($query['page']) && is_string($query['page']) && ctype_digit($query['page'])) {
            $page = (int) $query['page'];
        }

        return [
            'q' => $q,
            'page' => min(self::MAX_PAGINA, max(1, $page)),
        ];
    }

    /**
     * Valida el alta de una cuenta desde el panel Admin.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function crear(array $data): array
    {
        $errors = Validator::validate($data, [
            'nombre' => 'required|max:100',
            'email' => 'required|email|max:150',
            'password' => 'required|min:8',
        ]);

        $rol = $data['rol'] ?? 'usuario';

        if (!is_string($rol) || !in_array($rol, self::ROLES, true)) {
            $errors['rol'] = 'El rol debe ser usuario o admin.';
        }

        return $errors;
    }

    /**
     * Valida la edición de nombre, email y rol. La contraseña no se toca.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function actualizar(array $data): array
    {
        $errors = Validator::validate($data, [
            'nombre' => 'required|max:100',
            'email' => 'required|email|max:150',
            'rol' => 'required|in:usuario,admin',
        ]);

        return $errors;
    }
}
