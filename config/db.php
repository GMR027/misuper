<?php

declare(strict_types=1);

use App\Support\Env;

define('DB_HOST', Env::get('DB_HOST', '127.0.0.1'));
define('DB_NAME', Env::get('DB_NAME', 'misuper'));
define('DB_USER', Env::get('DB_USER', 'root'));
define('DB_PASS', Env::get('DB_PASS', ''));
