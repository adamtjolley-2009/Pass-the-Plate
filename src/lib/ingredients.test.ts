import { describe, it, expect } from "vitest";
import { parseQuantity, parseIngredientLine, formatQuantity, ingredientToLine } from "./ingredients";

describe("parseQuantity", () => {
  it.each([
    ["2", 2],
    ["1.5", 1.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["½", 0.5],
    ["1½", 1.5],
    ["1 ½", 1.5],
    ["⅓", 0.33],
    ["2 ¾", 2.75],
  ])("parses %s", (text, expected) => {
    expect(parseQuantity(text)).toBe(expected);
  });

  it("returns NaN for non-quantities", () => {
    expect(parseQuantity("")).toBeNaN();
    expect(parseQuantity("1/0")).toBeNaN();
    expect(parseQuantity("a few")).toBeNaN();
  });
});

describe("parseIngredientLine", () => {
  it("splits quantity, unit and name", () => {
    expect(parseIngredientLine("400 g spaghetti")).toEqual({
      name: "spaghetti",
      quantity: 400,
      unit: "g",
      originalQuantity: 400,
    });
  });

  it("handles fractions and attached units", () => {
    expect(parseIngredientLine("1 1/2 cups flour")).toMatchObject({ quantity: 1.5, unit: "cups", name: "flour" });
    expect(parseIngredientLine("1/2 tsp salt")).toMatchObject({ quantity: 0.5, unit: "tsp", name: "salt" });
    expect(parseIngredientLine("1½ cups milk")).toMatchObject({ quantity: 1.5, unit: "cups", name: "milk" });
    expect(parseIngredientLine("200g butter")).toMatchObject({ quantity: 200, unit: "g", name: "butter" });
  });

  it("only treats measurement words as units", () => {
    expect(parseIngredientLine("3 ripe bananas")).toMatchObject({ quantity: 3, unit: "", name: "ripe bananas" });
    expect(parseIngredientLine("2 large eggs")).toMatchObject({ quantity: 2, unit: "", name: "large eggs" });
    expect(parseIngredientLine("4 cloves garlic, minced")).toMatchObject({ quantity: 4, unit: "cloves", name: "garlic, minced" });
    expect(parseIngredientLine("1 Tbsp. olive oil")).toMatchObject({ quantity: 1, unit: "Tbsp", name: "olive oil" });
  });

  it("works without a unit", () => {
    expect(parseIngredientLine("2 eggs")).toMatchObject({ quantity: 2, unit: "", name: "eggs" });
  });

  it("falls back to the whole line when there is no quantity", () => {
    expect(parseIngredientLine("Salt to taste")).toMatchObject({ quantity: 1, unit: "", name: "Salt to taste" });
  });
});

describe("formatQuantity", () => {
  it.each([
    [0.5, "½"],
    [0.25, "¼"],
    [0.75, "¾"],
    [0.33, "⅓"],
    [1 / 3, "⅓"],
    [0.67, "⅔"],
    [0.125, "⅛"],
    [1.5, "1 ½"],
    [2.75, "2 ¾"],
    [4, "4"],
    [1.99, "2"],
    [0.15, "0.15"],
    [1.1, "1.1"],
    [0.01, "0.01"],
    [0, "0"],
  ])("formats %s as %s", (q, expected) => {
    expect(formatQuantity(q)).toBe(expected);
  });
});

describe("ingredientToLine", () => {
  it.each(["400 g spaghetti", "1 ½ cups flour", "¼ tsp salt", "2 eggs", "0.15 oz saffron"])(
    "round-trips %s through parse and format",
    (line) => {
      expect(ingredientToLine(parseIngredientLine(line))).toBe(line);
    }
  );

  it("uses the base quantity, not a scaled one", () => {
    expect(ingredientToLine({ name: "flour", unit: "cups", quantity: 3, originalQuantity: 1.5 })).toBe("1 ½ cups flour");
  });
});
