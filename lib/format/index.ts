const count = new Intl.NumberFormat("en-US");

/** 7082 → "7,082". */
export const formatCount = (n: number) => count.format(n);

/** 3 → "03". Ordinals in the plan list. */
export const pad2 = (n: number) => String(n).padStart(2, "0");
