<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\ApiTokenRepository;
use App\Repositories\UsuarioRepository;

/**
 * Emisión, validación y revocación de los tokens de la app Android.
 *
 * El token es de 32 bytes aleatorios en hexadecimal; en la BD solo vive su
 * SHA-256. No se usa password_hash porque el token ya tiene entropía de sobra.
 */
final class ApiTokenService
{
    private const TTL_DAYS = 180;

    private const TOKEN_PATTERN = '/^[a-f0-9]{64}$/';

    private readonly ApiTokenRepository $tokens;

    private readonly UsuarioRepository $usuarios;

    public function __construct(
        ?ApiTokenRepository $tokens = null,
        ?UsuarioRepository $usuarios = null
    ) {
        $this->tokens = $tokens ?? new ApiTokenRepository();
        $this->usuarios = $usuarios ?? new UsuarioRepository();
    }

    /**
     * Crea un token para una cuenta y lo devuelve en claro una sola vez.
     *
     * @return array{token: string, expires_at: string}
     */
    public function emitir(int $usuarioId, ?string $deviceName = null): array
    {
        $this->tokens->deleteExpiredForUser($usuarioId);

        $token = bin2hex(random_bytes(32));
        $expiresAt = (new \DateTimeImmutable('+' . self::TTL_DAYS . ' days'))
            ->format('Y-m-d H:i:s');

        $this->tokens->create(
            $usuarioId,
            hash('sha256', $token),
            $this->normalizarDevice($deviceName),
            $expiresAt
        );

        return ['token' => $token, 'expires_at' => $expiresAt];
    }

    /**
     * Devuelve el usuario del token, o null si no es válido o expiró.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool, avatar_tipo: string|null, avatar_valor: string|null, avatar_emoji: string|null, avatar_label: string|null}|null
     */
    public function autenticar(string $token): ?array
    {
        if (preg_match(self::TOKEN_PATTERN, $token) !== 1) {
            return null;
        }

        $hash = hash('sha256', $token);
        $row = $this->tokens->findValidByHash($hash);

        if ($row === null) {
            return null;
        }

        $usuario = $this->usuarios->findById($row['usuario_id']);

        if ($usuario === null) {
            $this->tokens->deleteByHash($hash);

            return null;
        }

        $this->tokens->touch($row['id']);

        return $usuario->toPublicArray();
    }

    public function revocar(string $token): bool
    {
        if (preg_match(self::TOKEN_PATTERN, $token) !== 1) {
            return false;
        }

        return $this->tokens->deleteByHash(hash('sha256', $token));
    }

    /**
     * Revoca todas las sesiones de una cuenta. Al cambiar la contraseña desde
     * la app se conserva el token actual para no expulsar al usuario.
     */
    public function revocarTodos(int $usuarioId, ?string $exceptToken = null): void
    {
        $exceptHash = $exceptToken !== null && preg_match(self::TOKEN_PATTERN, $exceptToken) === 1
            ? hash('sha256', $exceptToken)
            : null;

        $this->tokens->deleteAllForUser($usuarioId, $exceptHash);
    }

    private function normalizarDevice(?string $deviceName): ?string
    {
        if ($deviceName === null) {
            return null;
        }

        $deviceName = trim($deviceName);

        if ($deviceName === '') {
            return null;
        }

        return mb_substr($deviceName, 0, 120, 'UTF-8');
    }
}
