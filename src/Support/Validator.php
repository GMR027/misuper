<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Validación de entrada sin dependencias.
 *
 * Reglas: required, email, min, max, in.
 * Formato: ['campo' => 'required|email'] o ['campo' => ['required', 'min:3']].
 */
final class Validator
{
    /**
     * @param array<string, mixed> $data
     * @param array<string, string|array<int, string>> $rules
     * @return array<string, string> Errores por campo. Vacío si todo es válido.
     */
    public static function validate(array $data, array $rules): array
    {
        $errors = [];

        foreach ($rules as $field => $fieldRules) {
            $value = $data[$field] ?? null;
            $ruleList = is_array($fieldRules) ? $fieldRules : explode('|', $fieldRules);
            $label = self::label($field);

            if (in_array('required', $ruleList, true) && !self::required($value)) {
                $errors[$field] = "El campo {$label} es obligatorio.";

                continue;
            }

            if (!self::required($value)) {
                continue;
            }

            foreach ($ruleList as $rule) {
                if ($rule === 'required') {
                    continue;
                }

                [$name, $parameter] = self::parse($rule);

                $message = match ($name) {
                    'email' => self::email($value)
                        ? null
                        : "El campo {$label} debe ser un correo válido.",

                    'min' => self::min($value, (int) $parameter)
                        ? null
                        : "El campo {$label} debe tener al menos {$parameter} caracteres.",

                    'max' => self::max($value, (int) $parameter)
                        ? null
                        : "El campo {$label} debe tener como máximo {$parameter} caracteres.",

                    'in' => self::in($value, explode(',', (string) $parameter))
                        ? null
                        : "El campo {$label} no es un valor permitido.",

                    default => null,
                };

                if ($message !== null) {
                    $errors[$field] = $message;

                    break;
                }
            }
        }

        return $errors;
    }

    public static function required(mixed $value): bool
    {
        if (is_string($value)) {
            return trim($value) !== '';
        }

        return $value !== null;
    }

    public static function email(mixed $value): bool
    {
        return is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function min(mixed $value, int $min): bool
    {
        if (is_int($value) || is_float($value)) {
            return $value >= $min;
        }

        return is_string($value) && mb_strlen($value) >= $min;
    }

    public static function max(mixed $value, int $max): bool
    {
        if (is_int($value) || is_float($value)) {
            return $value <= $max;
        }

        return is_string($value) && mb_strlen($value) <= $max;
    }

    /**
     * @param array<int, string> $allowed
     */
    public static function in(mixed $value, array $allowed): bool
    {
        if (!is_scalar($value)) {
            return false;
        }

        return in_array((string) $value, array_map('strval', $allowed), true);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private static function parse(string $rule): array
    {
        $parts = explode(':', $rule, 2);

        return [$parts[0], $parts[1] ?? ''];
    }

    private static function label(string $field): string
    {
        return str_replace('_', ' ', $field);
    }
}
