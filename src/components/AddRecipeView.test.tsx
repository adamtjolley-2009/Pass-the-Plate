import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddRecipeView } from "./AddRecipeView";

const invoke = vi.fn();
const toastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useRecipes", () => ({ useAddRecipe: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ categories: ["Breakfast", "Dinner"], addCategory: vi.fn() }),
}));
vi.mock("@/lib/recipe-store", () => ({ useRecipeStore: () => ({ setActiveView: vi.fn() }) }));

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

  it("can open the paste box without trying a link first", () => {
    render(<AddRecipeView />);
    fireEvent.click(screen.getByRole("button", { name: "paste the recipe text" }));
    expect(screen.getByLabelText("Paste recipe text")).toBeInTheDocument();
  });
});
