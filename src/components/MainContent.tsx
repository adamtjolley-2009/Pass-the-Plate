import { useState } from "react";
import { useRecipeStore } from "@/lib/recipe-store";
import { useRecipes } from "@/hooks/useRecipes";
import { useCategories } from "@/hooks/useCategories";
import { RecipeCard } from "./RecipeCard";
import { RecipeDetail } from "./RecipeDetail";
import { FriendsView } from "./FriendsView";
import { GroupsView } from "./GroupsView";
import { AddRecipeView } from "./AddRecipeView";
import { ProfileView } from "./ProfileView";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export function MainContent() {
  const { activeView, selectedRecipeId, editingRecipeId, selectRecipe, setActiveView } = useRecipeStore();
  const { data: recipes = [], isLoading } = useRecipes();
  const { categories: userCategories, addCategory, removeCategory, isCustom } = useCategories();
  const categories = ["All", ...userCategories];
  const [activeCategory, setActiveCategory] = useState("All");
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  const handleAddCategory = () => {
    const ok = addCategory(newCat);
    if (!ok) {
      toast.error("Category is empty or already exists");
      return;
    }
    toast.success(`Added "${newCat.trim()}"`);
    setNewCat("");
    setAdding(false);
  };

  const handleRemoveCategory = (cat: string) => {
    removeCategory(cat);
    if (activeCategory === cat) setActiveCategory("All");
  };
  const isMobile = useIsMobile();
  const showDetail = isMobile && selectedRecipeId;

  if (activeView === "friends") return <FriendsView />;
  if (activeView === "groups") return <GroupsView />;
  if (activeView === "add") return <AddRecipeView />;
  if (activeView === "profile") return <ProfileView />;

  const editingRecipe = editingRecipeId ? recipes.find((r) => r.id === editingRecipeId) : undefined;
  if (editingRecipe) return <AddRecipeView key={editingRecipe.id} recipe={editingRecipe} />;

  const filteredRecipes = activeCategory === "All"
    ? recipes
    : recipes.filter((r) => r.tags.includes(activeCategory));

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Recipe List */}
      <div className={cn(
        "w-full md:w-[320px] shrink-0 overflow-y-auto border-r border-border p-4 space-y-3",
        showDetail && "hidden md:block"
      )}>
        <h2 className="px-1 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          My Library
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {categories.map((cat) => (
            <div key={cat} className="group relative inline-flex">
              <button
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  cat !== "All" && isCustom(cat) && "pr-5"
                )}
              >
                {cat}
              </button>
              {cat !== "All" && isCustom(cat) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCategory(cat);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-current opacity-60 hover:opacity-100"
                  aria-label={`Remove ${cat}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {adding ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewCat("");
                  }
                }}
                placeholder="New category"
                className="h-6 w-28 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleAddCategory}
                className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Add category"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          )}
        </div>
        <button
          onClick={() => setActiveView("add")}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Recipe
        </button>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredRecipes.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            {recipes.length === 0 ? "No recipes yet. Tap Add Recipe to create one." : "No recipes in this category."}
          </p>
        ) : (
          filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isSelected={recipe.id === selectedRecipeId}
              onClick={() => selectRecipe(recipe.id)}
            />
          ))
        )}
      </div>

      {/* Detail Pane */}
      <div className={cn(
        "flex-1 overflow-hidden",
        isMobile && !showDetail && "hidden md:block"
      )}>
        {selectedRecipe ? (
          <RecipeDetail
            recipe={selectedRecipe}
            onBack={isMobile ? () => selectRecipe(null) : undefined}
            backLabel="Back to library"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-lg font-display font-medium text-muted-foreground">
                Select a recipe
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose from your library to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
