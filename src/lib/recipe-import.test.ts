import { describe, it, expect } from "vitest";
import {
  extractJsonLdRecipe,
  formatDuration,
  htmlToText,
  parseAiJson,
  normalizeAiRecipe,
  decodeEntities,
} from "../../supabase/functions/parse-recipe-url/recipe";

const page = (jsonLd: unknown, extra = "") =>
  `<html><head><script src="x.js"></script>${extra}<script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>…</body></html>`;

describe("extractJsonLdRecipe", () => {
  it("reads a plain Recipe object (ISO times, yield list, HowToStep)", () => {
    const recipe = extractJsonLdRecipe(
      page({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Best Chocolate Chip Cookies",
        description: "Crisp edges &amp; chewy middles.",
        prepTime: "PT20M",
        cookTime: "PT1H10M",
        recipeYield: ["24", "24 cookies"],
        recipeCategory: "Dessert",
        recipeIngredient: ["1 cup butter, softened", "2 &frac12; cups flour"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Preheat oven to 350&deg;F." },
          { "@type": "HowToStep", text: "Cream <b>butter</b> and sugar." },
        ],
      })
    );
    expect(recipe).toEqual({
      title: "Best Chocolate Chip Cookies",
      description: "Crisp edges & chewy middles.",
      prepTime: "20 min",
      cookTime: "1 hr 10 min",
      servings: 24,
      ingredients: ["1 cup butter, softened", "2 ½ cups flour"],
      steps: ["Preheat oven to 350°F.", "Cream butter and sugar."],
      substitutes: [],
      category: "Desserts",
    });
  });

  it("finds the recipe inside an @graph with other entities", () => {
    const recipe = extractJsonLdRecipe(
      page(
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", name: "Food Blog" },
            { "@type": ["Recipe", "NewsArticle"], name: "Pancakes", recipeIngredient: ["2 eggs"], recipeYield: "4 servings",
              recipeInstructions: [{ "@type": "HowToSection", name: "Batter", itemListElement: [{ "@type": "HowToStep", text: "Whisk." }, { "@type": "HowToStep", text: "Rest." }] }] },
          ],
        },
        `<script type="application/ld+json">{ not valid json }</script>`
      )
    );
    expect(recipe).toMatchObject({ title: "Pancakes", servings: 4, steps: ["Whisk.", "Rest."], ingredients: ["2 eggs"] });
  });

  it("splits instructions given as one HTML string", () => {
    const recipe = extractJsonLdRecipe(
      page({ "@type": "Recipe", name: "Toast", recipeIngredient: ["1 slice bread"], recipeInstructions: "<p>Toast bread.</p><p>Butter it.</p>" })
    );
    expect(recipe?.steps).toEqual(["Toast bread.", "Butter it."]);
  });

  it("returns null when there is no usable recipe", () => {
    expect(extractJsonLdRecipe("<html><body>No data</body></html>")).toBeNull();
    expect(extractJsonLdRecipe(page({ "@type": "Article", name: "News" }))).toBeNull();
    expect(extractJsonLdRecipe(page({ "@type": "Recipe", name: "Empty", recipeIngredient: [] }))).toBeNull();
  });
});

describe("helpers", () => {
  it("formats durations", () => {
    expect(formatDuration("PT45M")).toBe("45 min");
    expect(formatDuration("PT2H")).toBe("2 hr");
    expect(formatDuration("PT0S")).toBe("");
    expect(formatDuration("20 minutes")).toBe("20 minutes");
  });

  it("decodes entities", () => {
    expect(decodeEntities("Mom&#39;s &quot;best&quot; &#x2014; pie")).toBe('Mom\'s "best" — pie');
  });

  it("turns HTML into readable text without scripts or menus", () => {
    const text = htmlToText("<nav>Home | About</nav><script>var x=1</script><h1>Soup</h1><p>Chop &amp; stir.</p>");
    expect(text).toBe("Soup\nChop & stir.");
  });

  it("parses AI replies with fences or extra words", () => {
    expect(parseAiJson('Sure!\n```json\n{"title":"Soup","ingredients":["1 onion"]}\n```')).toEqual({ title: "Soup", ingredients: ["1 onion"] });
    expect(parseAiJson("I couldn't find a recipe.")).toBeNull();
  });

  it("rejects AI answers without a recipe", () => {
    expect(normalizeAiRecipe({ title: "", ingredients: [] })).toBeNull();
    expect(normalizeAiRecipe({ title: "Soup", ingredients: ["1 onion"], servings: "6 bowls", category: "Main course" })).toMatchObject({
      servings: 6,
      category: "Dinner",
    });
  });
});
