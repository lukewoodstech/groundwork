export type RGB = [number, number, number];

// The only color in the product lives on the map.
export const US: RGB = [226, 152, 62]; // warm amber
export const PREV: RGB = [102, 136, 176]; // muted steel blue
export const FADED: RGB = [96, 96, 102]; // what both fade toward

const MAX_AGE_DAYS = 183;

/** Fade a companionship color toward grey as the work ages. */
export function ageColor(base: RGB, daysAgo: number): RGB {
  const t = Math.min(Math.max(daysAgo / MAX_AGE_DAYS, 0), 1) ** 0.75;
  return [
    Math.round(base[0] + (FADED[0] - base[0]) * t),
    Math.round(base[1] + (FADED[1] - base[1]) * t),
    Math.round(base[2] + (FADED[2] - base[2]) * t),
  ];
}
