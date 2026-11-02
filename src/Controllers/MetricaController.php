<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Services\MetricaService;
use App\Support\Response;

/**
 * Métricas personales del usuario: gasto mensual y top 10 productos.
 */
final class MetricaController
{
    private readonly MetricaService $metricas;

    public function __construct(?MetricaService $metricas = null)
    {
        $this->metricas = $metricas ?? new MetricaService();
    }

    /**
     * GET /metricas
     */
    public function index(): void
    {
        $usuario = $this->usuarioWeb();

        if ($usuario === null) {
            return;
        }

        $anioActual = (int) date('Y');
        $mesActual = (int) date('n');
        $anios = range(2020, max(2020, $anioActual));

        header('Content-Type: text/html; charset=utf-8');
        require BASE_PATH . '/src/Views/usuario/metricas.php';
    }

    /**
     * GET /api/metricas/gasto-mensual?anio=YYYY
     */
    public function gastoMensual(): void
    {
        $usuario = AuthMiddleware::require();
        $anio = MetricaService::anioValido($_GET['anio'] ?? null);

        if ($anio === null) {
            Response::fail(
                'VALIDATION_ERROR',
                'El año debe ser un número entre 2000 y 2100.',
                422,
                ['anio' => 'El año debe ser un número entre 2000 y 2100.']
            );
        }

        Response::ok($this->metricas->gastoMensual($usuario['id'], $anio));
    }

    /**
     * GET /api/metricas/top-productos?mes=&anio=
     */
    public function topProductos(): void
    {
        $usuario = AuthMiddleware::require();
        $mes = MetricaService::mesValido($_GET['mes'] ?? null);
        $anio = MetricaService::anioValido($_GET['anio'] ?? null);
        $errors = [];

        if ($mes === null) {
            $errors['mes'] = 'El mes debe ser un número entre 1 y 12.';
        }

        if ($anio === null) {
            $errors['anio'] = 'El año debe ser un número entre 2000 y 2100.';
        }

        if ($errors !== []) {
            Response::fail('VALIDATION_ERROR', 'Revisa los parámetros enviados.', 422, $errors);
        }

        Response::ok($this->metricas->topProductos($usuario['id'], (int) $mes, (int) $anio));
    }

    /**
     * Guard de sesión y cambio forzado de contraseña para la vista web.
     *
     * @return array{id: int, nombre: string, email: string, rol: string, debe_cambiar_password: bool}|null
     */
    private function usuarioWeb(): ?array
    {
        $usuario = AuthMiddleware::usuario();

        if ($usuario === null) {
            header('Location: /login', true, 302);

            return null;
        }

        if (($usuario['debe_cambiar_password'] ?? false) === true) {
            header('Location: /cambiar-password-forzado', true, 302);

            return null;
        }

        return $usuario;
    }
}
