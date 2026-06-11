import * as React from "react";

export type NavMatchMode = "exact" | "section";

export interface ResponsiveNavItem {
  to: string;
  label: string;
  matchMode?: NavMatchMode;
  mobilePriority?: number;
}

const FOUR_ITEM_BREAKPOINT = 430;

function dedupeNavItems<T extends ResponsiveNavItem>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.to)) {
      return false;
    }
    seen.add(item.to);
    return true;
  });
}

function sortByMobilePriority<T extends ResponsiveNavItem>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftPriority = left.mobilePriority ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = right.mobilePriority ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return items.indexOf(left) - items.indexOf(right);
  });
}

export function isNavRouteActive(
  pathname: string,
  path: string,
  matchMode: NavMatchMode = "section",
) {
  if (matchMode === "exact") {
    return pathname === path;
  }

  return path === "/"
    ? pathname === "/"
    : pathname === path || pathname.startsWith(`${path}/`);
}

export function useBottomNavCapacity() {
  const [capacity, setCapacity] = React.useState(4);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${FOUR_ITEM_BREAKPOINT - 1}px)`,
    );

    const updateCapacity = () => {
      setCapacity(window.innerWidth < FOUR_ITEM_BREAKPOINT ? 3 : 4);
    };

    updateCapacity();
    mediaQuery.addEventListener("change", updateCapacity);

    return () => mediaQuery.removeEventListener("change", updateCapacity);
  }, []);

  return capacity;
}

export function useResponsiveNav<T extends ResponsiveNavItem>(
  items: T[],
  pathname: string,
  capacity: number,
) {
  return React.useMemo(() => {
    const normalizedItems = dedupeNavItems(items);
    const prioritizedItems = sortByMobilePriority(normalizedItems);
    const safeCapacity = Math.max(1, capacity);
    const activeItem = normalizedItems.find((item) =>
      isNavRouteActive(pathname, item.to, item.matchMode),
    );

    const visibleItems = prioritizedItems.slice(0, safeCapacity);

    if (activeItem && !visibleItems.some((item) => item.to === activeItem.to)) {
      visibleItems[visibleItems.length - 1] = activeItem;
    }

    const visibleSet = new Set(visibleItems.map((item) => item.to));
    const overflowItems = normalizedItems.filter(
      (item) => !visibleSet.has(item.to),
    );

    return {
      visibleItems,
      overflowItems,
      activeItem,
      hasOverflow: overflowItems.length > 0,
    };
  }, [capacity, items, pathname]);
}
