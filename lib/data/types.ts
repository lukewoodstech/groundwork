export type Companionship = {
  id: string;
  name: string;
  start: string;
  end: string | null;
  isCurrent: boolean;
};

export type Walk = {
  id: string;
  companionshipId: string;
  date: string;
  path: [number, number][];
  timestamps: number[];
};

export type ActionType = "knock" | "contact" | "lesson";
export type Outcome = "none" | "interested" | "lesson_set";

export type Action = {
  id: string;
  companionshipId: string;
  walkId: string;
  type: ActionType;
  lngLat: [number, number];
  time: number;
  outcome: Outcome;
};

export type Appointment = {
  id: string;
  time: string;
  label: string;
  lngLat: [number, number];
};

export type Zone = {
  id: string;
  name: string;
  polygon: [number, number][];
};

export type Area = { name: string; polygon: [number, number][] };

/** A run of a walkable street inside the area. */
export type Street = { name: string; path: [number, number][] };

export type Who = "us" | "prev" | "all";

export type Filters = {
  who: Who;
  activity: Record<ActionType, boolean>;
  columns: boolean;
};
