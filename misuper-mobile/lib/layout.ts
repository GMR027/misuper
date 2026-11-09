/** Shared navigation and page dimensions (dp). */

export const DOCK_HEIGHT = 64;
export const DOCK_FAB_OVERHANG = 14;
export const CART_BAR_HEIGHT = 58;

/** The navigation rail on landscape phones and tablets. */
export const RAIL_WIDTH = 84;
export const RAIL_ITEM_WIDTH = 68;
export const RAIL_ITEM_HEIGHT = 56;
export const HEADER_HEIGHT = 60;

/** Page gutters: 16 on phones, 24 when there is room. */
export function pageGutter(width: number): number {
  return width >= 840 ? 24 : 16;
}
