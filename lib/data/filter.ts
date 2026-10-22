import type { Action, Companionship, Filters } from "./types";

export function filterActions(
  actions: Action[],
  companionships: Companionship[],
  filters: Filters,
): Action[] {
  const current = new Set(
    companionships.filter((c) => c.isCurrent).map((c) => c.id),
  );
  return actions.filter((a) => {
    if (!filters.activity[a.type]) return false;
    if (filters.who === "all") return true;
    const isUs = current.has(a.companionshipId);
    return filters.who === "us" ? isUs : !isUs;
  });
}
