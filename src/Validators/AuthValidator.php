<?php

declare(strict_types=1);

namespace App\Validators;

use App\Support\Validator;

/**
 * Validación server-side de los formularios de autenticación.
 */
final class AuthValidator
{
    /**
     * @param array<string, mixed> $data
     * @return array<string, string> Errores por campo (vacío si todo es válido).
     */
    public static function registro(array $data): array
    {
        return Validator::validate($data, [
            'nombre' => 'required|max:100',
            'email' => 'required|email|max:150',
            'password' => 'required|min:8',
        ]);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string> Errores por campo (vacío si todo es válido).
     */
    public static function login(array $data): array
    {
        return Validator::validate($data, [
            'email' => 'required|email|max:150',
            'password' => 'required',
        ]);
    }

    public static function normalizarEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }
}
