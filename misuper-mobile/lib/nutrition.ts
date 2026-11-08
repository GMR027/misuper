/** Estimated calories for a cart line, mirroring the backend's kitchen rules. */

import type { CartItem } from "@/lib/cart";

export interface CartNutrition {
  total: number;
  withData: number;
  withoutData: number;
}

function baseAmount(item: CartItem): number | null {
  const unit = item.unidad_base;
  const quantity = item.cantidad;

  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  switch (unit) {
    case "kg":
      return quantity * 1000;
    case "gr":
      return quantity;
    case "L":
      return quantity * 1000;
    case "ml":
      return quantity;
    case "pza":
      return item.peso_pieza_g !== null && item.peso_pieza_g > 0
        ? quantity * item.peso_pieza_g
        : null;
    default:
      return null;
  }
}

export function itemKcal(item: CartItem): number | null {
  if (item.kcal_100 === null || item.kcal_100 <= 0) return null;

  const amount = baseAmount(item);

  if (amount === null) return null;

  return (amount / 100) * item.kcal_100;
}

export function cartKcal(items: CartItem[]): CartNutrition {
  let total = 0;
  let withData = 0;
  let withoutData = 0;

  for (const item of items) {
    const value = itemKcal(item);

    if (value === null) {
      withoutData += 1;
    } else {
      total += value;
      withData += 1;
    }
  }

  return { total: Math.round(total), withData, withoutData };
}
