<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Usuario;
use App\Repositories\UsuarioRepository;
use PDOException;

/**
 * CRUD de cuentas desde el panel Admin.
 *
 * La contraseña temporal del reset se genera con random_int(), se devuelve
 * una sola vez y solo se persiste su hash con password_hash(PASSWORD_DEFAULT).
 */
final class AdminUsuarioService
{
    public const PER_PAGE = 20;

    public const LONGITUD_PASSWORD = 12;

    private const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

    private const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz';

    private const DIGITOS = '23456789';

    private const SIMBOLOS = '!@#$%^&*-_=+';

    private readonly UsuarioRepository $usuarios;

    public function __construct(?UsuarioRepository $usuarios = null)
    {
        $this->usuarios = $usuarios ?? new UsuarioRepository();
    }

    /**
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     total: int,
     *     page: int,
     *     per_page: int
     * }
     */
    public function listar(string $q, int $page): array
    {
        $page = max(1, $page);

        $resultado = $this->usuarios->searchAdmin(
            NormalizadorService::normalizar($q),
            $page,
            self::PER_PAGE
        );

        return [
            'items' => $resultado['items'],
            'total' => $resultado['total'],
            'page' => $page,
            'per_page' => self::PER_PAGE,
        ];
    }

    /**
     * Alta de una cuenta desde el panel Admin.
     *
     * @param array<string, mixed> $data
     * @return array{status: 'ok', usuario: array<string, mixed>}
     *       | array{status: 'email_duplicado'}
     */
    public function crear(array $data): array
    {
        $nombre = trim((string) ($data['nombre'] ?? ''));
        $email = mb_strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $rol = (string) ($data['rol'] ?? 'usuario');
        $debeCambiar = filter_var(
            $data['debe_cambiar_password'] ?? true,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        ) ?? true;

        if ($this->usuarios->emailExists($email)) {
            return ['status' => 'email_duplicado'];
        }

        try {
            $usuario = $this->usuarios->createAdmin(
                $nombre,
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                $rol,
                $debeCambiar
            );
        } catch (PDOException $error) {
            // Carrera entre dos altas simultáneas: la clave única decide.
            if ((string) $error->getCode() === '23000') {
                return ['status' => 'email_duplicado'];
            }

            throw $error;
        }

        $creado = $this->usuarios->findById($usuario->id) ?? $usuario;

        return ['status' => 'ok', 'usuario' => self::publico($creado)];
    }

    /**
     * Edición de nombre, email y rol. Nunca cambia la contraseña.
     *
     * El propio Admin conserva su rol para no quedarse sin acceso al panel.
     *
     * @param array<string, mixed> $data
     * @return array{status: 'ok', usuario: array<string, mixed>}
     *       | array{status: 'not_found'}
     *       | array{status: 'email_duplicado'}
     */
    public function actualizar(int $id, array $data, int $adminId): array
    {
        $usuario = $this->usuarios->findById($id);

        if ($usuario === null) {
            return ['status' => 'not_found'];
        }

        $nombre = trim((string) ($data['nombre'] ?? ''));
        $email = mb_strtolower(trim((string) ($data['email'] ?? '')));
        $rol = (string) ($data['rol'] ?? $usuario->rol);

        if ($usuario->id === $adminId) {
            $rol = $usuario->rol;
        }

        if ($this->usuarios->emailExistsExcept($email, $id)) {
            return ['status' => 'email_duplicado'];
        }

        try {
            $this->usuarios->updateAdmin($id, $nombre, $email, $rol);
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') {
                return ['status' => 'email_duplicado'];
            }

            throw $error;
        }

        $actualizado = $this->usuarios->findById($id) ?? $usuario;

        return ['status' => 'ok', 'usuario' => self::publico($actualizado)];
    }

    /**
     * Hard delete desde el panel Admin. Limpia avatar y fotos de notas.
     *
     * @return array{status: 'ok'} | array{status: 'not_found'} | array{status: 'self'}
     */
    public function eliminar(int $id, int $adminId): array
    {
        if ($id === $adminId) {
            return ['status' => 'self'];
        }

        if ($this->usuarios->findById($id) === null) {
            return ['status' => 'not_found'];
        }

        (new AccountService($this->usuarios))->eliminarCuenta($id);

        return ['status' => 'ok'];
    }

    /**
     * Genera una contraseña temporal, aplica su hash y marca el cambio
     * obligatorio. Nunca guarda la contraseña en claro.
     *
     * @return array{status: 'ok', password_temporal: string, usuario_id: int, email: string}
     *       | array{status: 'not_found'}
     *       | array{status: 'self'}
     */
    public function resetPassword(int $id, int $adminId): array
    {
        $usuario = $this->usuarios->findById($id);

        if ($usuario === null) {
            return ['status' => 'not_found'];
        }

        if ($usuario->id === $adminId) {
            return ['status' => 'self'];
        }

        $passwordTemporal = self::generarPasswordTemporal();

        $this->usuarios->updatePasswordHashAndSetFlag(
            $usuario->id,
            password_hash($passwordTemporal, PASSWORD_DEFAULT)
        );

        return [
            'status' => 'ok',
            'password_temporal' => $passwordTemporal,
            'usuario_id' => $usuario->id,
            'email' => $usuario->email,
        ];
    }

    /**
     * Contraseña de 12 caracteres con al menos una mayúscula, una minúscula,
     * un dígito y un símbolo. Usa random_int() en todo el proceso.
     */
    public static function generarPasswordTemporal(): string
    {
        $conjuntos = [self::MAYUSCULAS, self::MINUSCULAS, self::DIGITOS, self::SIMBOLOS];
        $pool = implode('', $conjuntos);

        $caracteres = [];

        foreach ($conjuntos as $conjunto) {
            $caracteres[] = $conjunto[random_int(0, strlen($conjunto) - 1)];
        }

        while (count($caracteres) < self::LONGITUD_PASSWORD) {
            $caracteres[] = $pool[random_int(0, strlen($pool) - 1)];
        }

        // Mezcla Fisher-Yates con random_int (criptográficamente segura).
        for ($i = count($caracteres) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$caracteres[$i], $caracteres[$j]] = [$caracteres[$j], $caracteres[$i]];
        }

        return implode('', $caracteres);
    }

    /**
     * @return array<string, mixed>
     */
    private static function publico(Usuario $usuario): array
    {
        $data = $usuario->toPublicArray();
        $data['created_at'] = $usuario->createdAt;

        return $data;
    }
}
