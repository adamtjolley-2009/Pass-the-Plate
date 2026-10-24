import { create } from "zustand";

export type View = "library" | "friends" | "groups" | "add" | "profile";

// UI-only state. Recipes, friends and groups live in Supabase (see src/hooks).
interface RecipeStore {
  selectedRecipeId: string | null;
  // Library recipe open in the edit form, if any
  editingRecipeId: string | null;
  activeView: View;
  checkedIngredients: Record<string, Set<number>>;

  selectRecipe: (id: string | null) => void;
  setActiveView: (view: View) => void;
  startEditing: (recipeId: string) => void;
  stopEditing: () => void;
  toggleIngredientCheck: (recipeId: string, ingredientIndex: number) => void;
}

export const useRecipeStore = create<RecipeStore>((set) => ({
  selectedRecipeId: null,
  editingRecipeId: null,
  activeView: "library",
  checkedIngredients: {},

  selectRecipe: (id) => set({ selectedRecipeId: id }),
  setActiveView: (view) => set({ activeView: view, selectedRecipeId: null, editingRecipeId: null }),
  startEditing: (recipeId) => set({ activeView: "library", selectedRecipeId: recipeId, editingRecipeId: recipeId }),
  stopEditing: () =>
    // Ingredient positions may have changed, so drop that recipe's ticked boxes
    set((state) => {
      const checkedIngredients = { ...state.checkedIngredients };
      if (state.editingRecipeId) delete checkedIngredients[state.editingRecipeId];
      return { editingRecipeId: null, checkedIngredients };
    }),

  toggleIngredientCheck: (recipeId, ingredientIndex) =>
    set((state) => {
      const s = new Set(state.checkedIngredients[recipeId]);
      if (s.has(ingredientIndex)) s.delete(ingredientIndex);
      else s.add(ingredientIndex);
      return { checkedIngredients: { ...state.checkedIngredients, [recipeId]: s } };
    }),
}));
