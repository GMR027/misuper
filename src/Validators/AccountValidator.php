<?php

declare(strict_types=1);

namespace App\Validators;

use App\Support\Validator;

/**
 * Validación server-side de la gestión de cuenta.
 *
 * A diferencia de los formularios de autenticación, aquí los campos del
 * perfil son opcionales: solo se valida lo que llega en la petición.
 */
final class AccountValidator
{
    /**
     * Valida el cuerpo de PUT /api/me.
     *
     * @param array<string, mixed> $data
     * @return array<string, string> Errores por campo (vacío si todo es válido).
     */
    public static function perfil(array $data): array
    {
        $tieneNombre = array_key_exists('nombre', $data);
        $tieneEmail = array_key_exists('email', $data);

        if (!$tieneNombre && !$tieneEmail) {
            return ['_general' => 'No hay nada que actualizar.'];
        }

        $errors = [];

        if ($tieneNombre) {
            $nombre = $data['nombre'];

            if (!is_string($nombre) || mb_strlen(trim($nombre)) < 2) {
                $errors['nombre'] = 'El nombre debe tener al menos 2 caracteres.';
            } elseif (mb_strlen(trim($nombre)) > 100) {
                $errors['nombre'] = 'El nombre debe tener como máximo 100 caracteres.';
            }
        }

        if ($tieneEmail) {
            $email = $data['email'];
            $normalizado = is_string($email) ? self::normalizarEmail($email) : '';

            if (!Validator::email($normalizado)) {
                $errors['email'] = 'El email debe ser un correo válido.';
            } elseif (mb_strlen($normalizado) > 150) {
                $errors['email'] = 'El email debe tener como máximo 150 caracteres.';
            }
        }

        return $errors;
    }

    /**
     * Valida el cuerpo de PUT /api/me/password.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function password(array $data): array
    {
        $errors = Validator::validate($data, [
            'password_actual' => 'required',
            'password_nueva' => 'required|min:8',
        ]);

        if (
            !isset($errors['password_nueva'])
            && is_string($data['password_actual'] ?? null)
            && is_string($data['password_nueva'] ?? null)
            && $data['password_actual'] === $data['password_nueva']
        ) {
            $errors['password_nueva'] = 'La nueva contraseña debe ser distinta de la actual.';
        }

        return $errors;
    }

    /**
     * Valida el cuerpo de POST /api/me/password-forzado.
     *
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function passwordForzado(array $data): array
    {
        return Validator::validate($data, [
            'password_nueva' => 'required|min:8',
        ]);
    }

    public static function normalizarEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }
}
