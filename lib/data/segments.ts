import type { Walk } from "./types";

export type Segment = {
  key: string;
  path: [number, number][];
  count: number;
  lastTime: number;
  /** Companionship of the most recent pass. */
  companionshipId: string;
};

const pointKey = (p: [number, number]) => `${p[0]},${p[1]}`;

/**
 * Collapse walks into street segments. Walk paths run node to node along
 * real streets, so consecutive points of different walks line up exactly
 * and the same stretch of road always gets the same key.
 */
export function walkedSegments(walks: Walk[]): Segment[] {
  const out = new Map<string, Segment>();
  for (const w of walks) {
    for (let i = 1; i < w.path.length; i++) {
      const a = w.path[i - 1];
      const b = w.path[i];
      const ka = pointKey(a);
      const kb = pointKey(b);
      if (ka === kb) continue;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const t = w.timestamps[i];
      const s = out.get(key);
      if (!s) {
        out.set(key, { key, path: [a, b], count: 1, lastTime: t, companionshipId: w.companionshipId });
      } else {
        s.count += 1;
        if (t > s.lastTime) {
          s.lastTime = t;
          s.companionshipId = w.companionshipId;
        }
      }
    }
  }
  return [...out.values()];
}
