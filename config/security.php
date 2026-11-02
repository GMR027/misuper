<?php

declare(strict_types=1);

return [
    'headers' => [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Content-Security-Policy' => "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' https://cdn.jsdelivr.net; script-src 'self' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ],

    'session' => [
        'httponly' => true,
        'samesite' => 'Lax',
        'secure_in_production' => true,
    ],

    'csrf' => [
        'enabled' => true,
    ],
];
