/**
 * The last unit cost remembered for each product, like the web's
 * `misuper.precios_unidad` map. It only feeds the calculator's suggestion.
 */

import { readJson, writeJson } from "@/lib/db";
import { roundMoney } from "@/lib/numbers";

const KEY = "misuper.precios_unidad";

type PriceMap = Record<string, number>;

export function readUnitPrice(productId: number): number | null {
  if (!Number.isInteger(productId) || productId <= 0) return null;

  const map = readJson<PriceMap>(KEY, {});
  const value = Number(map[String(productId)]);

  return Number.isFinite(value) && value >= 0 ? roundMoney(value) : null;
}

export function saveUnitPrice(productId: number, price: number): void {
  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return;
  }

  const map = readJson<PriceMap>(KEY, {});
  map[String(productId)] = roundMoney(price);
  writeJson(KEY, map);
}
