import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Recipe, Ingredient, Substitute } from "@/lib/types";

type StoredIngredient = Omit<Ingredient, "originalQuantity"> & { originalQuantity?: number };

// Convert DB row to app Recipe type
function dbToRecipe(row: Tables<"recipes">): Recipe {
  const ingredients: Ingredient[] = ((row.ingredients ?? []) as unknown as StoredIngredient[]).map((ing) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    originalQuantity: ing.originalQuantity ?? ing.quantity,
  }));

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    prepTime: row.prep_time ?? "—",
    cookTime: row.cook_time ?? "—",
    baseServings: row.base_servings,
    currentServings: row.base_servings,
    ingredients,
    steps: row.steps ?? [],
    substitutes: (row.substitutes as unknown as Substitute[] | null) ?? [],
    tags: row.tags ?? [],
    author: row.original_author_name ?? "You",
    authorId: row.original_author_id ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isFavorite: row.is_favorite ?? false,
  };
}

// The recipe fields a user can edit, in DB format
function recipeFields(recipe: Recipe) {
  return {
    title: recipe.title,
    description: recipe.description || null,
    prep_time: recipe.prepTime || null,
    cook_time: recipe.cookTime || null,
    base_servings: recipe.baseServings,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      originalQuantity: ing.originalQuantity,
    })),
    steps: recipe.steps,
    substitutes: (recipe.substitutes ?? []) as unknown as Json,
    tags: recipe.tags,
    image_url: recipe.imageUrl || null,
    is_favorite: recipe.isFavorite ?? false,
  } satisfies TablesUpdate<"recipes">;
}

// Convert app Recipe to DB insert format
function recipeToDb(recipe: Recipe, userId: string): TablesInsert<"recipes"> {
  return { user_id: userId, ...recipeFields(recipe) };
}

export function useRecipes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recipes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(dbToRecipe);
    },
    enabled: !!user,
  });
}

export function useAddRecipe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipe: Recipe) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("recipes")
        .insert(recipeToDb(recipe, user.id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipe: Recipe) => {
      const { data, error } = await supabase
        .from("recipes")
        .update(recipeFields(recipe))
        .eq("id", recipe.id)
        .select("id");
      if (error) throw error;
      // Row-level security silently skips recipes you don't own
      if (!data?.length) throw new Error("Recipe not found or not yours to edit");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useFriendRecipes(friendUserId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friend-recipes", friendUserId],
    queryFn: async () => {
      if (!user || !friendUserId) return [];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", friendUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToRecipe);
    },
    enabled: !!user && !!friendUserId,
  });
}

export function useCopyRecipe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipe,
      originalAuthorName,
      originalAuthorId,
    }: {
      recipe: Recipe;
      originalAuthorName: string;
      originalAuthorId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const dbData = recipeToDb(recipe, user.id);
      // Preserve the very first creator if recipe was already a copy
      const finalAuthorName =
        recipe.author && recipe.author !== "You" ? recipe.author : originalAuthorName;
      const finalAuthorId = recipe.authorId ?? originalAuthorId;
      const { error } = await supabase
        .from("recipes")
        .insert({
          ...dbData,
          original_author_name: finalAuthorName,
          original_author_id: finalAuthorId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}
