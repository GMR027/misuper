<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\AvatarCatalog;

/**
 * Cuenta de la aplicación.
 *
 * passwordHash solo se usa dentro del dominio de autenticación:
 * nunca debe salir en respuestas HTTP (ver toPublicArray()).
 */
final class Usuario
{
    public function __construct(
        public readonly int $id,
        public readonly string $nombre,
        public readonly string $email,
        public readonly string $passwordHash,
        public readonly string $rol,
        public readonly bool $debeCambiarPassword,
        public readonly ?string $createdAt = null,
        public readonly ?string $avatarTipo = null,
        public readonly ?string $avatarValor = null,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) $row['id'],
            nombre: (string) $row['nombre'],
            email: (string) $row['email'],
            passwordHash: (string) $row['password_hash'],
            rol: (string) $row['rol'],
            debeCambiarPassword: (bool) ($row['debe_cambiar_password'] ?? false),
            createdAt: isset($row['created_at']) ? (string) $row['created_at'] : null,
            avatarTipo: isset($row['avatar_tipo']) ? (string) $row['avatar_tipo'] : null,
            avatarValor: isset($row['avatar_valor']) ? (string) $row['avatar_valor'] : null,
        );
    }

    /**
     * Representación segura para la API (sin password_hash).
     *
     * @return array{
     *     id: int,
     *     nombre: string,
     *     email: string,
     *     rol: string,
     *     debe_cambiar_password: bool,
     *     avatar_tipo: string|null,
     *     avatar_valor: string|null,
     *     avatar_emoji: string|null,
     *     avatar_label: string|null
     * }
     */
    public function toPublicArray(): array
    {
        $avatar = $this->avatarTipo === 'preset' && $this->avatarValor !== null
            ? AvatarCatalog::get($this->avatarValor)
            : null;

        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'email' => $this->email,
            'rol' => $this->rol,
            'debe_cambiar_password' => $this->debeCambiarPassword,
            'avatar_tipo' => $this->avatarTipo,
            'avatar_valor' => $this->avatarValor,
            'avatar_emoji' => $avatar['emoji'] ?? null,
            'avatar_label' => $avatar['label'] ?? null,
        ];
    }

    public function isAdmin(): bool
    {
        return $this->rol === 'admin';
    }
}
