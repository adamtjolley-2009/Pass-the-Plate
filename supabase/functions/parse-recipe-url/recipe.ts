// Pure helpers for the parse-recipe-url function (no Deno APIs, so they can be
// unit tested with vitest from src/).

export interface ParsedRecipe {
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number | null;
  ingredients: string[];
  steps: string[];
  substitutes: { original: string; replacement: string }[];
  category: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Strips tags/entities and collapses whitespace
function clean(value: JsonValue | undefined): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return decodeEntities(String(value).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// "PT1H20M" -> "1 hr 20 min"; plain text like "20 minutes" is kept as-is
export function formatDuration(value: JsonValue | undefined): string {
  const text = clean(value);
  const match = text.match(/^P(?:\d+D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:\d+(?:\.\d+)?S)?$/i);
  if (!match) return text;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const total = Math.round(hours * 60 + minutes);
  if (total === 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

function parseServings(value: JsonValue | undefined): number | null {
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    const n = parseInt(clean(v as JsonValue), 10);
    if (n > 0) return n;
  }
  return null;
}

function parseInstructions(value: JsonValue | undefined): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(/<\/(?:p|li)>|<br\s*\/?>|\n/i)
      .map((s) => clean(s))
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap(parseInstructions);
  if (typeof value === "object") {
    // HowToSection groups steps; HowToStep has the text
    if (value.itemListElement) return parseInstructions(value.itemListElement);
    const text = clean(value.text ?? value.name);
    return text ? [text] : [];
  }
  return [];
}

const CATEGORY_MATCHES: [RegExp, string][] = [
  [/breakfast|brunch/i, "Breakfast"],
  [/lunch/i, "Lunch"],
  [/dinner|main|entr[eé]e|supper/i, "Dinner"],
  [/appetizer|starter|snack/i, "Appetizers"],
  [/dessert|baking|sweet/i, "Desserts"],
];

export function matchCategory(value: JsonValue | undefined): string {
  const values = (Array.isArray(value) ? value : [value]).map((v) => clean(v as JsonValue));
  for (const v of values) {
    for (const [pattern, category] of CATEGORY_MATCHES) {
      if (pattern.test(v)) return category;
    }
  }
  return "";
}

function isRecipe(node: JsonObject): boolean {
  const type = node["@type"];
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

function findRecipeNode(value: JsonValue): JsonObject | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    if (isRecipe(value)) return value;
    if (value["@graph"]) return findRecipeNode(value["@graph"]);
    if (value.mainEntity) return findRecipeNode(value.mainEntity);
  }
  return null;
}

// Reads the schema.org Recipe that most recipe sites embed for search engines
export function extractJsonLdRecipe(html: string): ParsedRecipe | null {
  const scripts = html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: JsonValue;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (!node) continue;

    const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [])
      .map((i) => clean(i))
      .filter(Boolean);
    const steps = parseInstructions(node.recipeInstructions);
    if (!clean(node.name) || ingredients.length === 0) continue;

    return {
      title: clean(node.name),
      description: clean(node.description),
      prepTime: formatDuration(node.prepTime),
      cookTime: formatDuration(node.cookTime) || formatDuration(node.totalTime),
      servings: parseServings(node.recipeYield),
      ingredients,
      steps,
      substitutes: [],
      category: matchCategory(node.recipeCategory),
    };
  }
  return null;
}

// Readable page text for the AI fallback: no scripts, styles, menus or markup
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Pulls the JSON object out of an AI reply, tolerating code fences or extra text
export function parseAiJson(content: string): JsonObject | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Normalizes the AI's answer into the same shape as the JSON-LD path
export function normalizeAiRecipe(data: JsonObject): ParsedRecipe | null {
  const strings = (v: JsonValue | undefined) => (Array.isArray(v) ? v.map((x) => clean(x)).filter(Boolean) : []);
  const ingredients = strings(data.ingredients);
  const title = clean(data.title);
  if (!title || ingredients.length === 0) return null;
  const substitutes = (Array.isArray(data.substitutes) ? data.substitutes : [])
    .filter((s): s is JsonObject => !!s && typeof s === "object" && !Array.isArray(s))
    .map((s) => ({ original: clean(s.original), replacement: clean(s.replacement) }))
    .filter((s) => s.original);
  return {
    title,
    description: clean(data.description),
    prepTime: clean(data.prepTime),
    cookTime: clean(data.cookTime),
    servings: parseServings(data.servings),
    ingredients,
    steps: strings(data.steps),
    substitutes,
    category: matchCategory(data.category),
  };
}
