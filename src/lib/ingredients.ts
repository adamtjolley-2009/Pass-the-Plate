import { Ingredient } from "./types";

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅛": 1 / 8,
};

// Parses quantities like "2", "1.5", "1/2", "1 1/2", "½" and "1½".
// Returns NaN when the text isn't a quantity.
export function parseQuantity(text: string): number {
  const parts = text
    .trim()
    // Split "1½" into "1 ½" so each piece can be summed
    .replace(/(\d)([½⅓⅔¼¾⅛])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return NaN;

  let total = 0;
  for (const part of parts) {
    if (part in UNICODE_FRACTIONS) {
      total += UNICODE_FRACTIONS[part];
    } else if (/^\d+\/\d+$/.test(part)) {
      const [num, den] = part.split("/").map(Number);
      if (den === 0) return NaN;
      total += num / den;
    } else if (/^\d*\.?\d+$/.test(part)) {
      total += Number(part);
    } else {
      return NaN;
    }
  }
  return Math.round(total * 100) / 100;
}

// Parses a line like "400 g spaghetti" into an ingredient.
// Lines without a leading quantity become a single unit of the whole line.
export function parseIngredientLine(line: string): Ingredient {
  const match = line.trim().match(/^([\d./½⅓⅔¼¾⅛]+(?:\s+[\d./½⅓⅔¼¾⅛]+)*)\s*([A-Za-z]+)?\s+(.+)$/);
  if (match) {
    const qty = parseQuantity(match[1]);
    if (qty > 0) {
      return { name: match[3].trim(), quantity: qty, unit: match[2] || "", originalQuantity: qty };
    }
  }
  return { name: line.trim(), quantity: 1, unit: "", originalQuantity: 1 };
}

const DISPLAY_FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

// Shows quantities the way recipes write them: 0.5 -> "½", 1.25 -> "1 ¼",
// 0.67 -> "⅔". Anything that isn't close to a common fraction keeps up to two
// decimals, e.g. 0.15 -> "0.15".
export function formatQuantity(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return "0";
  let whole = Math.floor(q);
  let frac = q - whole;
  if (frac > 0.97) {
    whole += 1;
    frac = 0;
  }
  if (frac < 0.03) return String(whole || Number(q.toFixed(2)));

  const match = DISPLAY_FRACTIONS.find(([value]) => Math.abs(frac - value) < 0.02);
  if (!match) return String(Number(q.toFixed(2)));
  return whole ? `${whole} ${match[1]}` : match[1];
}
