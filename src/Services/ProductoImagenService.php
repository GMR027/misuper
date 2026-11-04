<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\ProductoRepository;

/**
 * Verificación de las imágenes remotas del catálogo.
 *
 * "Foto vencida" = la URL ya no responde o devuelve un error HTTP. La
 * comprobación se hace en lote con HEAD para no descargar las imágenes.
 */
final class ProductoImagenService
{
    private const LOTE = 20;

    private const TIMEOUT_CONEXION = 4;

    private const TIMEOUT_TOTAL = 8;

    private readonly ProductoRepository $productos;

    public function __construct(?ProductoRepository $productos = null)
    {
        $this->productos = $productos ?? new ProductoRepository();
    }

    /**
     * Verifica todas las imágenes del catálogo global y guarda su estado.
     *
     * @return array{revisadas: int, vigentes: int, vencidas: int}
     */
    public function verificarTodas(): array
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(120);
        }

        $productos = $this->productos->productosConImagen();
        $resumen = [
            'revisadas' => 0,
            'vigentes' => 0,
            'vencidas' => 0,
        ];

        foreach (array_chunk($productos, self::LOTE) as $lote) {
            $resultados = $this->verificarLote($lote);

            foreach ($resultados as $productoId => $vigente) {
                $this->productos->setImagenEstado($productoId, $vigente ? 'ok' : 'vencida');

                $resumen['revisadas']++;
                $resumen[$vigente ? 'vigentes' : 'vencidas']++;
            }
        }

        return $resumen;
    }

    /**
     * @param array<int, array{id: int, imagen_url: string}> $lote
     * @return array<int, bool> ID de producto => true si la imagen responde
     */
    private function verificarLote(array $lote): array
    {
        $mh = curl_multi_init();
        $handles = [];

        foreach ($lote as $producto) {
            if (!$this->urlPermitida($producto['imagen_url'])) {
                $handles[$producto['id']] = null;

                continue;
            }

            $handle = curl_init();

            if ($handle === false) {
                $handles[$producto['id']] = null;

                continue;
            }

            curl_setopt_array($handle, [
                CURLOPT_URL => $producto['imagen_url'],
                CURLOPT_NOBODY => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
                CURLOPT_CONNECTTIMEOUT => self::TIMEOUT_CONEXION,
                CURLOPT_TIMEOUT => self::TIMEOUT_TOTAL,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_USERAGENT => 'MiSuper/1.0 (verificacion de imagenes)',
                CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            ]);

            curl_multi_add_handle($mh, $handle);
            $handles[$producto['id']] = $handle;
        }

        do {
            $status = curl_multi_exec($mh, $activos);

            if ($activos > 0) {
                curl_multi_select($mh, 1.0);
            }
        } while ($activos > 0 && $status === CURLM_OK);

        $resultados = [];

        foreach ($handles as $productoId => $handle) {
            if ($handle === null) {
                $resultados[$productoId] = false;

                continue;
            }

            $codigo = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            $error = curl_errno($handle);

            // 200-399 es correcto. 405/501: el servidor no admite HEAD pero
            // la URL existe. 401/403, 404, 410 y 5xx se consideran vencidas.
            $resultados[$productoId] = $error === 0
                && (($codigo >= 200 && $codigo < 400) || $codigo === 405 || $codigo === 501);

            curl_multi_remove_handle($mh, $handle);
            curl_close($handle);
        }

        curl_multi_close($mh);

        return $resultados;
    }

    /**
     * Evita que la verificación pueda apuntar a la red interna (SSRF).
     */
    private function urlPermitida(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (!is_string($host) || $host === '') {
            return false;
        }

        $ip = filter_var($host, FILTER_VALIDATE_IP) !== false
            ? $host
            : gethostbyname($host);

        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return false;
        }

        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) !== false;
    }
}
