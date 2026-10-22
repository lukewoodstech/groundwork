// Edgemont neighborhood, north Provo, Utah.
export const AREA_CENTER: [number, number] = [-111.6455, 40.2785];

export const INITIAL_VIEW = {
  center: AREA_CENTER,
  zoom: 14.7,
  pitch: 55,
  bearing: -18,
};

// Demo clock. The data window is the 6 months ending today.
export const TODAY = new Date("2026-10-22T12:00:00-06:00");
export const RANGE_DAYS = 183;
export const DAY_MS = 86_400_000;
