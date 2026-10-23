import { describe, it, expect } from "vitest";
import { parseQuantity, parseIngredientLine, formatQuantity } from "./ingredients";

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
