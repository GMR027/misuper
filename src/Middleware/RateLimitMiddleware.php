<?php

declare(strict_types=1);

namespace App\Middleware;

/**
 * Rate limiting en archivo (storage/logs/rate_limit.json).
 *
 * - Login: 5 intentos fallidos por IP + email cada 15 minutos.
 * - Registro: 3 registros exitosos por IP cada hora.
 *
 * Las claves se guardan hasheadas (sha256) para no persistir emails en claro.
 * El archivo se accede con flock para soportar peticiones concurrentes.
 * Si el archivo no se puede abrir, se permite la petición (fail-open) y se
 * registra el problema en el log del servidor.
 */
final class RateLimitMiddleware
{
    private const LOGIN_LIMIT = 5;
    private const LOGIN_WINDOW = 900;
    private const REGISTER_LIMIT = 3;
    private const REGISTER_WINDOW = 3600;

    public static function clientIp(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';

        return is_string($ip) && $ip !== '' ? $ip : '0.0.0.0';
    }

    /**
     * Segundos de espera si el login está bloqueado; null si puede intentarlo.
     */
    public static function loginRetryAfter(string $ip, string $email): ?int
    {
        $key = self::loginKey($ip, $email);

        return self::mutate(static function (array &$store) use ($key): ?int {
            $entry = $store['login'][$key] ?? null;

            if (!is_array($entry) || (int) ($entry['count'] ?? 0) < self::LOGIN_LIMIT) {
                return null;
            }

            $remaining = (int) ($entry['first'] ?? 0) + self::LOGIN_WINDOW - time();

            return $remaining > 0 ? $remaining : null;
        });
    }

    public static function recordFailedLogin(string $ip, string $email): void
    {
        $key = self::loginKey($ip, $email);
        $now = time();

        self::mutate(static function (array &$store) use ($key, $now): void {
            $entry = $store['login'][$key] ?? null;

            if (!is_array($entry) || (int) ($entry['first'] ?? 0) + self::LOGIN_WINDOW <= $now) {
                $store['login'][$key] = ['count' => 1, 'first' => $now];

                return;
            }

            $store['login'][$key] = [
                'count' => ((int) ($entry['count'] ?? 0)) + 1,
                'first' => (int) $entry['first'],
            ];
        });
    }

    public static function clearLoginAttempts(string $ip, string $email): void
    {
        $key = self::loginKey($ip, $email);

        self::mutate(static function (array &$store) use ($key): void {
            unset($store['login'][$key]);
        });
    }

    /**
     * Segundos de espera si el registro está bloqueado; null si puede intentarlo.
     */
    public static function registrationRetryAfter(string $ip): ?int
    {
        $key = self::registerKey($ip);

        return self::mutate(static function (array &$store) use ($key): ?int {
            $entry = $store['register'][$key] ?? null;

            if (!is_array($entry) || (int) ($entry['count'] ?? 0) < self::REGISTER_LIMIT) {
                return null;
            }

            $remaining = (int) ($entry['first'] ?? 0) + self::REGISTER_WINDOW - time();

            return $remaining > 0 ? $remaining : null;
        });
    }

    public static function recordRegistration(string $ip): void
    {
        $key = self::registerKey($ip);
        $now = time();

        self::mutate(static function (array &$store) use ($key, $now): void {
            $entry = $store['register'][$key] ?? null;

            if (!is_array($entry) || (int) ($entry['first'] ?? 0) + self::REGISTER_WINDOW <= $now) {
                $store['register'][$key] = ['count' => 1, 'first' => $now];

                return;
            }

            $store['register'][$key] = [
                'count' => ((int) ($entry['count'] ?? 0)) + 1,
                'first' => (int) $entry['first'],
            ];
        });
    }

    private static function loginKey(string $ip, string $email): string
    {
        return hash('sha256', 'login|' . $ip . '|' . mb_strtolower(trim($email)));
    }

    private static function registerKey(string $ip): string
    {
        return hash('sha256', 'register|' . $ip);
    }

    /**
     * Abre el almacén con bloqueo exclusivo, aplica la mutación y persiste.
     *
     * @param callable(array<string, mixed>&): mixed $mutation
     */
    private static function mutate(callable $mutation): mixed
    {
        $path = self::storagePath();
        $handle = @fopen($path, 'c+');

        if ($handle === false) {
            error_log('[rate-limit] No se pudo abrir ' . $path);

            $vacio = [];

            return $mutation($vacio);
        }

        @chmod($path, 0600);

        try {
            if (!flock($handle, LOCK_EX)) {
                error_log('[rate-limit] No se pudo bloquear ' . $path);

                $vacio = [];

                return $mutation($vacio);
            }

            $raw = stream_get_contents($handle);
            $store = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
            $store = is_array($store) ? $store : [];

            self::prune($store);

            $result = $mutation($store);

            $encoded = json_encode($store, JSON_UNESCAPED_SLASHES);

            if ($encoded !== false) {
                rewind($handle);

                if (ftruncate($handle, 0)) {
                    fwrite($handle, $encoded);
                    fflush($handle);
                }
            }

            return $result;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Elimina entradas cuya ventana ya expiró.
     *
     * @param array<string, mixed> $store
     */
    private static function prune(array &$store): void
    {
        $now = time();
        $windows = [
            'login' => self::LOGIN_WINDOW,
            'register' => self::REGISTER_WINDOW,
        ];

        foreach ($windows as $bucket => $window) {
            if (!isset($store[$bucket]) || !is_array($store[$bucket])) {
                $store[$bucket] = [];

                continue;
            }

            foreach ($store[$bucket] as $key => $entry) {
                if (!is_array($entry) || (int) ($entry['first'] ?? 0) + $window <= $now) {
                    unset($store[$bucket][$key]);
                }
            }
        }
    }

    private static function storagePath(): string
    {
        $base = defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__, 2);

        return $base . '/storage/logs/rate_limit.json';
    }
}
