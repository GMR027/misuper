/**
 * Window-size helpers, following Material 3's window size classes.
 *
 * The app is used on phones (portrait and landscape), tablets and foldables:
 * a width of 600 dp is the point where the bottom dock gives way to a
 * navigation rail and the content can start using more than one column.
 */

import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RAIL_WIDTH, pageGutter } from "@/lib/layout";

export const BREAKPOINTS = {
  medium: 600,
  expanded: 840,
  large: 1200,
} as const;

export type WindowSizeClass =
  | "compact"
  | "medium"
  | "expanded"
  | "large";

export interface ResponsiveLayout {
  width: number;
  height: number;
  isLandscape: boolean;
  windowSizeClass: WindowSizeClass;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isLarge: boolean;
  /** True when navigation should be a rail (landscape phones, tablets). */
  useRail: boolean;
  /** True when a screen can show two independent panes. */
  useTwoPane: boolean;
  /** The real width available to page content: window minus rail and gutters. */
  contentWidth: number;
  /** Recommended number of columns for the product grid. */
  productColumns: number;
  /** Recommended number of columns for the recipe grid. */
  recipeColumns: number;
  /** A comfortable maximum width for a page with cards and lists. */
  pageMaxWidth: number;
  /** A shorter maximum width for long-form text. */
  readingMaxWidth: number;
}

function sizeClass(width: number): WindowSizeClass {
  if (width >= BREAKPOINTS.large) return "large";
  if (width >= BREAKPOINTS.expanded) return "expanded";
  if (width >= BREAKPOINTS.medium) return "medium";
  return "compact";
}

/** Cards per row: 2 on phones, up to 5 on large tablets. */
export function gridColumns(width: number, max = 5): number {
  if (width >= BREAKPOINTS.large) return max;
  if (width >= BREAKPOINTS.expanded) return Math.min(4, max);
  if (width >= BREAKPOINTS.medium) return Math.min(3, max);
  return Math.min(2, max);
}

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const windowSizeClass = sizeClass(width);
  const useRail = width >= BREAKPOINTS.medium;
  const pageMaxWidth = width >= BREAKPOINTS.large ? 1160 : 980;
  const railSpace = useRail ? RAIL_WIDTH + insets.left : 0;
  const usableWidth = Math.min(
    pageMaxWidth,
    Math.max(0, width - railSpace - insets.right),
  );
  const contentWidth = Math.max(0, usableWidth - pageGutter(width) * 2);

  return {
    width,
    height,
    isLandscape: width > height,
    windowSizeClass,
    isCompact: windowSizeClass === "compact",
    isMedium: windowSizeClass === "medium",
    isExpanded: windowSizeClass === "expanded",
    isLarge: windowSizeClass === "large",
    useRail,
    useTwoPane: width >= BREAKPOINTS.expanded,
    contentWidth,
    productColumns: gridColumns(contentWidth),
    recipeColumns: gridColumns(contentWidth),
    pageMaxWidth,
    readingMaxWidth: 760,
  };
}
