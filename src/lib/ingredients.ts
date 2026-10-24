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

// Words treated as a unit when they follow the quantity, e.g. "2 cups flour".
// Anything else stays part of the name, so "3 ripe bananas" is 3 × "ripe bananas".
const UNITS = new Set([
  "g", "gram", "grams", "kg", "kilogram", "kilograms", "mg",
  "ml", "milliliter", "milliliters", "millilitre", "millilitres", "l", "liter", "liters", "litre", "litres",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "cup", "cups", "c", "tbsp", "tbs", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
  "pint", "pints", "pt", "quart", "quarts", "qt", "gallon", "gallons", "fl",
  "pinch", "pinches", "dash", "dashes", "clove", "cloves", "can", "cans", "jar", "jars",
  "stick", "sticks", "slice", "slices", "piece", "pieces", "package", "packages", "pkg",
  "bunch", "bunches", "sprig", "sprigs", "handful", "handfuls", "head", "heads",
]);

// Parses a line like "400 g spaghetti" into an ingredient.
// Lines without a leading quantity become a single unit of the whole line.
export function parseIngredientLine(line: string): Ingredient {
  const match = line.trim().match(/^([\d./½⅓⅔¼¾⅛]+(?:\s+[\d./½⅓⅔¼¾⅛]+)*)\s*(.+)$/);
  if (match) {
    const qty = parseQuantity(match[1]);
    if (qty > 0) {
      const rest = match[2].trim();
      const unitMatch = rest.match(/^([A-Za-z]+)\.?\s+(.+)$/);
      if (unitMatch && UNITS.has(unitMatch[1].toLowerCase())) {
        return { name: unitMatch[2].trim(), quantity: qty, unit: unitMatch[1], originalQuantity: qty };
      }
      return { name: rest, quantity: qty, unit: "", originalQuantity: qty };
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

// Turns a saved ingredient back into the line it was typed as, e.g. "1 ½ cups flour".
// Uses the base-servings quantity so editing doesn't bake in any scaling.
export function ingredientToLine(ing: Ingredient): string {
  return [formatQuantity(ing.originalQuantity), ing.unit, ing.name].filter(Boolean).join(" ");
}
