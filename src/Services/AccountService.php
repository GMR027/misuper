<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Usuario;
use App\Repositories\UsuarioRepository;
use PDOException;

/**
 * Reglas de negocio de la cuenta autenticada: perfil, contraseña y baja.
 */
final class AccountService
{
    private readonly UsuarioRepository $usuarios;

    public function __construct(?UsuarioRepository $usuarios = null)
    {
        $this->usuarios = $usuarios ?? new UsuarioRepository();
    }

    /**
     * Actualiza solo los campos presentes en $data.
     *
     * @param array<string, mixed> $data
     * @return Usuario|null null si el email ya pertenece a otra cuenta.
     */
    public function actualizarPerfil(int $id, array $data): ?Usuario
    {
        $nombre = array_key_exists('nombre', $data) ? trim((string) $data['nombre']) : null;
        $email = array_key_exists('email', $data) ? self::normalizarEmail((string) $data['email']) : null;

        if ($email !== null && $this->usuarios->emailExistsExcept($email, $id)) {
            return null;
        }

        try {
            $this->usuarios->updateProfile($id, $nombre, $email);
        } catch (PDOException $error) {
            // Carrera con otro cambio simultáneo: la clave única decide.
            if ((string) $error->getCode() === '23000') {
                return null;
            }

            throw $error;
        }

        return $this->usuarios->findById($id);
    }

    /**
     * Cambia la contraseña verificando la actual y limpia la marca de cambio forzado.
     * Devuelve false si el usuario no existe o la contraseña actual no coincide.
     */
    public function cambiarPassword(int $id, string $passwordActual, string $passwordNueva): bool
    {
        $usuario = $this->usuarios->findById($id);

        if ($usuario === null || !password_verify($passwordActual, $usuario->passwordHash)) {
            return false;
        }

        $this->usuarios->updatePasswordHashAndClearFlag(
            $id,
            password_hash($passwordNueva, PASSWORD_DEFAULT)
        );

        return true;
    }

    /**
     * Cambio de contraseña sin pedir la actual. El llamador debe haber
     * comprobado antes que debe_cambiar_password = true.
     */
    public function cambiarPasswordForzado(int $id, string $passwordNueva): void
    {
        $this->usuarios->updatePasswordHashAndClearFlag(
            $id,
            password_hash($passwordNueva, PASSWORD_DEFAULT)
        );
    }

    /**
     * Hard delete. Las FK en cascada borran el resto de datos del usuario
     * cuando existan esas tablas. También elimina la foto de perfil subida.
     */
    public function eliminarCuenta(int $id): void
    {
        $usuario = $this->usuarios->findById($id);

        if ($usuario !== null && $usuario->avatarTipo === 'foto') {
            (new AvatarService())->deleteStoredPhoto($usuario->avatarValor);
        }

        (new NotaService())->eliminarArchivosDeUsuario($id);

        $this->usuarios->delete($id);
    }

    private static function normalizarEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }
}
