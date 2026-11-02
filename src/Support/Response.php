<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Respuestas HTTP con el contrato de la API:
 * { ok: bool, data: any, error: { code, message } | null }
 */
final class Response
{
    public static function ok(mixed $data = null, int $status = 200): never
    {
        self::json([
            'ok' => true,
            'data' => $data,
            'error' => null,
        ], $status);
    }

    public static function fail(string $code, string $message, int $status = 400, mixed $data = null): never
    {
        self::json([
            'ok' => false,
            'data' => $data,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ], $status);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');

        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        exit;
    }
}
