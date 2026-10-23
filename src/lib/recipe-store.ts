import { create } from "zustand";

export type View = "library" | "friends" | "groups" | "add" | "profile";

// UI-only state. Recipes, friends and groups live in Supabase (see src/hooks).
interface RecipeStore {
  selectedRecipeId: string | null;
  activeView: View;
  checkedIngredients: Record<string, Set<number>>;

  selectRecipe: (id: string | null) => void;
  setActiveView: (view: View) => void;
  toggleIngredientCheck: (recipeId: string, ingredientIndex: number) => void;
}

export const useRecipeStore = create<RecipeStore>((set) => ({
  selectedRecipeId: null,
  activeView: "library",
  checkedIngredients: {},

  selectRecipe: (id) => set({ selectedRecipeId: id }),
  setActiveView: (view) => set({ activeView: view, selectedRecipeId: null }),

  toggleIngredientCheck: (recipeId, ingredientIndex) =>
    set((state) => {
      const s = new Set(state.checkedIngredients[recipeId]);
      if (s.has(ingredientIndex)) s.delete(ingredientIndex);
      else s.add(ingredientIndex);
      return { checkedIngredients: { ...state.checkedIngredients, [recipeId]: s } };
    }),
}));
