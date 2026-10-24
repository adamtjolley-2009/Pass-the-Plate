import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddRecipeView } from "./AddRecipeView";
import type { Recipe } from "@/lib/types";

const invoke = vi.fn();
const updateRecipe = vi.fn();
const addRecipe = vi.fn();
const removeFile = vi.fn();
const stopEditing = vi.fn();
const toastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    storage: { from: () => ({ remove: (...a: unknown[]) => removeFile(...a) }) },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useRecipes", () => ({
  useAddRecipe: () => ({ mutateAsync: (...a: unknown[]) => addRecipe(...a), isPending: false }),
  useUpdateRecipe: () => ({ mutateAsync: (...a: unknown[]) => updateRecipe(...a), isPending: false }),
}));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ categories: ["Breakfast", "Dinner"], addCategory: vi.fn() }),
}));
vi.mock("@/lib/image", () => ({
  shrinkImage: async (file: File) => ({ data: `b64-${file.name}`, mediaType: "image/jpeg" }),
}));
vi.mock("@/lib/recipe-store", () => ({ useRecipeStore: () => ({ setActiveView: vi.fn(), stopEditing }) }));

// supabase.functions.invoke reports non-2xx responses as an error whose context is the Response
const blockedError = () => ({
  data: null,
  error: {
    context: new Response(
      JSON.stringify({ success: false, code: "blocked", error: "That website doesn't allow automatic imports." }),
      { status: 502 }
    ),
  },
});

describe("AddRecipeView import", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers to paste the recipe text when a site blocks the import, then fills the form", async () => {
    invoke.mockResolvedValueOnce(blockedError()).mockResolvedValueOnce({
      data: {
        success: true,
        recipe: { title: "Banana Bread", ingredients: ["3 ripe bananas", "1 1/2 cups flour"], steps: ["Mash.", "Bake."], servings: 8, category: "Breakfast" },
      },
      error: null,
    });
    render(<AddRecipeView />);

    fireEvent.change(screen.getByPlaceholderText("Paste a recipe URL..."), {
      target: { value: "simplyrecipes.com/recipes/banana_bread/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    const pasteBox = await screen.findByLabelText("Paste recipe text");
    expect(invoke).toHaveBeenCalledWith("parse-recipe-url", {
      body: { url: "https://simplyrecipes.com/recipes/banana_bread/" },
    });
    expect(toastError).toHaveBeenCalledWith("That website doesn't allow automatic imports.");

    fireEvent.change(pasteBox, { target: { value: "Banana Bread ... 3 ripe bananas ... Mash. Bake." } });
    fireEvent.click(screen.getByRole("button", { name: "Read recipe" }));

    await waitFor(() => expect(screen.getByDisplayValue("Banana Bread")).toBeInTheDocument());
    expect(invoke).toHaveBeenLastCalledWith("parse-recipe-url", {
      body: { text: "Banana Bread ... 3 ripe bananas ... Mash. Bake." },
    });
    expect(screen.queryByLabelText("Paste recipe text")).not.toBeInTheDocument();
  });

  it("reads a recipe from photos of a recipe card", async () => {
    invoke.mockResolvedValueOnce({
      data: { success: true, recipe: { title: "Grandma's Pie", ingredients: ["2 cups flour"], steps: ["Bake."] } },
      error: null,
    });
    render(<AddRecipeView />);

    const front = new File(["a"], "front.jpg", { type: "image/jpeg" });
    const back = new File(["b"], "back.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("scan-input"), { target: { files: [front, back] } });

    await waitFor(() => expect(screen.getByDisplayValue("Grandma's Pie")).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("parse-recipe-url", {
      body: {
        images: [
          { data: "b64-front.jpg", mediaType: "image/jpeg" },
          { data: "b64-back.jpg", mediaType: "image/jpeg" },
        ],
      },
    });
  });

  it("rejects more than 4 photos", () => {
    render(<AddRecipeView />);
    const files = Array.from({ length: 5 }, (_, i) => new File(["x"], `${i}.jpg`, { type: "image/jpeg" }));
    fireEvent.change(screen.getByTestId("scan-input"), { target: { files } });
    expect(toastError).toHaveBeenCalledWith("Choose up to 4 photos");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("can open the paste box without trying a link first", () => {
    render(<AddRecipeView />);
    fireEvent.click(screen.getByRole("button", { name: "paste the recipe text" }));
    expect(screen.getByLabelText("Paste recipe text")).toBeInTheDocument();
  });
});

const banana: Recipe = {
  id: "r1",
  title: "Banana Bread",
  description: "Moist and easy",
  prepTime: "15 min",
  cookTime: "—",
  baseServings: 8,
  currentServings: 8,
  ingredients: [
    { name: "ripe bananas", quantity: 3, unit: "", originalQuantity: 3 },
    { name: "flour", quantity: 1.5, unit: "cups", originalQuantity: 1.5 },
  ],
  steps: ["Mash the bananas.", "Bake for 60 minutes."],
  substitutes: [{ original: "Butter", replacement: "coconut oil" }],
  tags: ["Breakfast"],
  author: "You",
  imageUrl: "https://x.supabase.co/storage/v1/object/public/recipe-images/u1/old.jpg",
};

describe("AddRecipeView editing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens with the recipe filled in and no URL import", () => {
    render(<AddRecipeView recipe={banana} />);
    expect(screen.getByRole("heading", { name: "Edit Recipe" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Banana Bread")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15 min")).toBeInTheDocument();
    expect(screen.getByDisplayValue("8")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/400 g spaghetti/)).toHaveValue("3 ripe bananas\n1 ½ cups flour");
    expect(screen.getByDisplayValue("Butter → coconut oil")).toBeInTheDocument();
    expect(screen.getByAltText("Preview")).toHaveAttribute("src", banana.imageUrl);
    expect(screen.queryByPlaceholderText("Paste a recipe URL...")).not.toBeInTheDocument();
  });

  it("saves changes to the same recipe and keeps the photo", async () => {
    updateRecipe.mockResolvedValue(undefined);
    render(<AddRecipeView recipe={banana} />);
    fireEvent.change(screen.getByDisplayValue("Banana Bread"), { target: { value: "Best Banana Bread" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(stopEditing).toHaveBeenCalled());
    expect(addRecipe).not.toHaveBeenCalled();
    expect(updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "r1",
        title: "Best Banana Bread",
        baseServings: 8,
        imageUrl: banana.imageUrl,
        tags: ["Breakfast"],
        ingredients: [
          expect.objectContaining({ name: "ripe bananas", quantity: 3, unit: "" }),
          expect.objectContaining({ name: "flour", quantity: 1.5, unit: "cups" }),
        ],
      })
    );
    expect(removeFile).not.toHaveBeenCalled();
  });

  it("deletes the old photo file when the photo is removed", async () => {
    updateRecipe.mockResolvedValue(undefined);
    render(<AddRecipeView recipe={banana} />);
    fireEvent.click(screen.getByAltText("Preview").nextElementSibling as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(stopEditing).toHaveBeenCalled());
    expect(updateRecipe).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: undefined }));
    expect(removeFile).toHaveBeenCalledWith(["u1/old.jpg"]);
  });

  it("Cancel leaves without saving", () => {
    render(<AddRecipeView recipe={banana} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(stopEditing).toHaveBeenCalled();
    expect(updateRecipe).not.toHaveBeenCalled();
  });
});
