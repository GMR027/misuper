<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Usuario;
use App\Services\NormalizadorService;
use App\Support\Database;
use PDO;

/**
 * Acceso a la tabla usuarios. Siempre con prepared statements.
 */
final class UsuarioRepository
{
    private const COLUMNS = 'id, nombre, email, password_hash, rol, debe_cambiar_password, created_at, avatar_tipo, avatar_valor';

    private readonly PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::connection();
    }

    public function findByEmail(string $email): ?Usuario
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM usuarios WHERE email = ? LIMIT 1'
        );
        $statement->execute([$email]);

        $row = $statement->fetch();

        return $row === false ? null : Usuario::fromRow($row);
    }

    public function findById(int $id): ?Usuario
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM usuarios WHERE id = ? LIMIT 1'
        );
        $statement->execute([$id]);

        $row = $statement->fetch();

        return $row === false ? null : Usuario::fromRow($row);
    }

    public function emailExists(string $email): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM usuarios WHERE email = ? LIMIT 1');
        $statement->execute([$email]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * Listado paginado del panel Admin, con búsqueda por nombre o email.
     *
     * @param string $q Texto ya normalizado (minúsculas y sin acentos).
     * @return array{
     *     items: array<int, array{
     *         id: int,
     *         nombre: string,
     *         email: string,
     *         rol: string,
     *         debe_cambiar_password: bool,
     *         created_at: string
     *     }>,
     *     total: int
     * }
     */
    public function searchAdmin(string $q, int $page, int $perPage): array
    {
        $where = '';
        $params = [];

        if ($q !== '') {
            // La collation general_ci es insensible a mayúsculas y acentos.
            $where = " WHERE (LOWER(nombre) COLLATE utf8mb4_general_ci LIKE ? ESCAPE '!'"
                . " OR LOWER(email) COLLATE utf8mb4_general_ci LIKE ? ESCAPE '!')";
            $patron = '%' . NormalizadorService::patronLike($q) . '%';
            $params = [$patron, $patron];
        }

        $count = $this->pdo->prepare('SELECT COUNT(*) FROM usuarios' . $where);
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $offset = ($page - 1) * $perPage;

        $statement = $this->pdo->prepare(
            'SELECT id, nombre, email, rol, debe_cambiar_password, created_at FROM usuarios'
            . $where
            . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
        );

        $index = 1;

        foreach ($params as $param) {
            $statement->bindValue($index++, $param, PDO::PARAM_STR);
        }

        $statement->bindValue($index++, $perPage, PDO::PARAM_INT);
        $statement->bindValue($index, $offset, PDO::PARAM_INT);
        $statement->execute();

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $items[] = [
                'id' => (int) $row['id'],
                'nombre' => (string) $row['nombre'],
                'email' => (string) $row['email'],
                'rol' => (string) $row['rol'],
                'debe_cambiar_password' => (bool) $row['debe_cambiar_password'],
                'created_at' => (string) $row['created_at'],
            ];
        }

        return ['items' => $items, 'total' => $total];
    }

    /**
     * Comprueba si el email pertenece a otra cuenta distinta de $exceptId.
     */
    public function emailExistsExcept(string $email, int $exceptId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM usuarios WHERE email = ? AND id <> ? LIMIT 1'
        );
        $statement->execute([$email, $exceptId]);

        return $statement->fetchColumn() !== false;
    }

    public function create(string $nombre, string $email, string $passwordHash): Usuario
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO usuarios (nombre, email, password_hash, rol, debe_cambiar_password)
             VALUES (?, ?, ?, ?, ?)'
        );
        $statement->execute([$nombre, $email, $passwordHash, 'usuario', 0]);

        return new Usuario(
            id: (int) $this->pdo->lastInsertId(),
            nombre: $nombre,
            email: $email,
            passwordHash: $passwordHash,
            rol: 'usuario',
            debeCambiarPassword: false,
        );
    }

    /**
     * Alta de una cuenta desde el panel Admin, con rol y marca de cambio
     * de contraseña configurables.
     */
    public function createAdmin(
        string $nombre,
        string $email,
        string $passwordHash,
        string $rol,
        bool $debeCambiarPassword
    ): Usuario {
        $statement = $this->pdo->prepare(
            'INSERT INTO usuarios (nombre, email, password_hash, rol, debe_cambiar_password)
             VALUES (?, ?, ?, ?, ?)'
        );
        $statement->execute([$nombre, $email, $passwordHash, $rol, $debeCambiarPassword ? 1 : 0]);

        return new Usuario(
            id: (int) $this->pdo->lastInsertId(),
            nombre: $nombre,
            email: $email,
            passwordHash: $passwordHash,
            rol: $rol,
            debeCambiarPassword: $debeCambiarPassword,
        );
    }

    /**
     * Edición de una cuenta desde el panel Admin. No toca la contraseña:
     * para eso existe el reset manual y /ajustes.
     */
    public function updateAdmin(int $id, string $nombre, string $email, string $rol): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?'
        );
        $statement->execute([$nombre, $email, $rol, $id]);
    }

    public function updatePasswordHash(int $id, string $passwordHash): void
    {
        $statement = $this->pdo->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?');
        $statement->execute([$passwordHash, $id]);
    }

    /**
     * Guarda el hash de una contraseña temporal y exige el cambio al
     * siguiente inicio de sesión.
     */
    public function updatePasswordHashAndSetFlag(int $id, string $passwordHash): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = TRUE WHERE id = ?'
        );
        $statement->execute([$passwordHash, $id]);
    }

    /**
     * Actualiza solo los campos no nulos del perfil.
     */
    public function updateProfile(int $id, ?string $nombre, ?string $email): void
    {
        $sets = [];
        $params = [];

        if ($nombre !== null) {
            $sets[] = 'nombre = ?';
            $params[] = $nombre;
        }

        if ($email !== null) {
            $sets[] = 'email = ?';
            $params[] = $email;
        }

        if ($sets === []) {
            return;
        }

        $params[] = $id;

        $statement = $this->pdo->prepare(
            'UPDATE usuarios SET ' . implode(', ', $sets) . ' WHERE id = ?'
        );
        $statement->execute($params);
    }

    /**
     * Reemplaza el avatar del usuario. NULL borra foto y avatar.
     */
    public function updateAvatar(int $id, ?string $tipo, ?string $valor): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE usuarios SET avatar_tipo = ?, avatar_valor = ? WHERE id = ?'
        );
        $statement->execute([$tipo, $valor, $id]);
    }

    /**
     * Guarda el nuevo hash y desactiva el cambio forzado de contraseña.
     */
    public function updatePasswordHashAndClearFlag(int $id, string $passwordHash): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = FALSE WHERE id = ?'
        );
        $statement->execute([$passwordHash, $id]);
    }

    public function delete(int $id): void
    {
        $statement = $this->pdo->prepare('DELETE FROM usuarios WHERE id = ?');
        $statement->execute([$id]);
    }
}
