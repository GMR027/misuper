<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Usuario;
use App\Repositories\UsuarioRepository;
use PDOException;

/**
 * Reglas de negocio de autenticación.
 */
final class AuthService
{
    /**
     * Hash de relleno para igualar tiempos cuando el email no existe.
     * Verificar contra él siempre falla para contraseñas arbitrarias.
     */
    private const DUMMY_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    private readonly UsuarioRepository $usuarios;

    public function __construct(?UsuarioRepository $usuarios = null)
    {
        $this->usuarios = $usuarios ?? new UsuarioRepository();
    }

    /**
     * Registra un usuario con rol 'usuario'.
     * Devuelve null si el email ya está registrado.
     */
    public function register(string $nombre, string $email, string $password): ?Usuario
    {
        $email = mb_strtolower(trim($email));
        $nombre = trim($nombre);

        if ($this->usuarios->emailExists($email)) {
            return null;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        try {
            return $this->usuarios->create($nombre, $email, $hash);
        } catch (PDOException $error) {
            // Carrera entre dos registros simultáneos: la clave única decide.
            if ((string) $error->getCode() === '23000') {
                return null;
            }

            throw $error;
        }
    }

    /**
     * Devuelve el usuario si las credenciales son válidas; null si no.
     */
    public function login(string $email, string $password): ?Usuario
    {
        $usuario = $this->usuarios->findByEmail(mb_strtolower(trim($email)));

        if ($usuario === null) {
            password_verify($password, self::DUMMY_HASH);

            return null;
        }

        if (!password_verify($password, $usuario->passwordHash)) {
            return null;
        }

        if (password_needs_rehash($usuario->passwordHash, PASSWORD_DEFAULT)) {
            $this->usuarios->updatePasswordHash(
                $usuario->id,
                password_hash($password, PASSWORD_DEFAULT)
            );
        }

        return $usuario;
    }
}
