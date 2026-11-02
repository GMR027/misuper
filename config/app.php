<?php

declare(strict_types=1);

use App\Support\Env;

return [
    'env' => Env::get('APP_ENV', 'local'),
    'url' => rtrim(Env::get('APP_URL', 'http://localhost:8000'), '/'),
    'session_lifetime' => (int) Env::get('SESSION_LIFETIME', '604800'),
];
