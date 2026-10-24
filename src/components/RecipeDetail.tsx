import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Copy, Trash2, ArrowRightLeft, ArrowLeft, Pencil } from "lucide-react";
import { Recipe } from "@/lib/types";
import { useRecipeStore } from "@/lib/recipe-store";
import { useDeleteRecipe } from "@/hooks/useRecipes";
import { ServingStepper } from "./ServingStepper";
import { IngredientItem } from "./IngredientItem";
import { formatQuantity } from "@/lib/ingredients";
import { toast } from "sonner";

interface RecipeDetailProps {
  recipe: Recipe;
  // Hides owner-only actions, e.g. when previewing a friend's recipe
  readOnly?: boolean;
  // Shows a Back button above the recipe (e.g. on phones, or from a friend's list)
  onBack?: () => void;
  backLabel?: string;
}

export function RecipeDetail({ recipe, readOnly = false, onBack, backLabel = "Back" }: RecipeDetailProps) {
  const { toggleIngredientCheck, checkedIngredients, selectRecipe, startEditing } = useRecipeStore();
  const deleteRecipeMutation = useDeleteRecipe();
  const checked = checkedIngredients[recipe.id] || new Set();

  const [servings, setServings] = useState(recipe.currentServings);

  // Reset servings when a different recipe is selected
  const [prevId, setPrevId] = useState(recipe.id);
  if (recipe.id !== prevId) {
    setPrevId(recipe.id);
    setServings(recipe.currentServings);
  }

  const scaledIngredients = useMemo(() => {
    const ratio = servings / recipe.baseServings;
    return recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: Math.round(ing.originalQuantity * ratio * 100) / 100,
    }));
  }, [servings, recipe.baseServings, recipe.ingredients]);

  const handleCopyIngredients = async () => {
    const text = scaledIngredients
      .map((i) => `${formatQuantity(i.quantity)} ${i.unit} ${i.name}`.replace(/\s+/g, " ").trim())
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Ingredients copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${recipe.title}"? This can't be undone.`)) return;
    try {
      await deleteRecipeMutation.mutateAsync(recipe.id);
      selectRecipe(null);
      toast.success("Recipe removed");
    } catch {
      toast.error("Failed to delete recipe");
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={recipe.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
        className="h-full overflow-y-auto p-6 lg:p-8"
      >
        {onBack && (
          <button
            onClick={onBack}
            className="-ml-2 mb-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
        )}

        {/* Image */}
        {recipe.imageUrl && (
          <div className="mb-6 overflow-hidden rounded-2xl">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full max-h-80 object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1
            className="font-display font-semibold text-foreground leading-tight"
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
              letterSpacing: "-0.03em",
            }}
          >
            {recipe.title}
          </h1>
          <p className="mt-2 font-body text-base text-muted-foreground max-w-[65ch]" style={{ lineHeight: 1.6 }}>
            {recipe.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Prep: {recipe.prepTime}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Cook: {recipe.cookTime}
            </span>
            {recipe.author !== "You" && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                by {recipe.author}
              </span>
            )}
          </div>
        </div>

        {/* Servings */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <ServingStepper
            servings={servings}
            onChange={setServings}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCopyIngredients}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            {!readOnly && (
              <button
                onClick={() => startEditing(recipe.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
            {!readOnly && (
              <button
                onClick={handleDelete}
                disabled={deleteRecipeMutation.isPending}
                aria-label="Delete recipe"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Ingredients */}
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Ingredients</h2>
          <div className="space-y-0.5">
            {scaledIngredients.map((ing, idx) => (
              <IngredientItem
                key={`${ing.name}-${idx}`}
                name={ing.name}
                quantity={ing.quantity}
                unit={ing.unit}
                checked={checked.has(idx)}
                onToggle={() => toggleIngredientCheck(recipe.id, idx)}
              />
            ))}
          </div>
        </section>

        {/* Substitutes */}
        {recipe.substitutes && recipe.substitutes.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Substitutes</h2>
            <div className="space-y-0.5">
              {recipe.substitutes.map((sub, idx) => (
                <div
                  key={idx}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <ArrowRightLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{sub.original}</span>
                  {sub.replacement && (
                    <>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-body text-foreground">{sub.replacement}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Steps */}
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Instructions</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step, idx) => (
              <li key={idx} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                  {idx + 1}
                </span>
                <p className="font-body text-foreground pt-0.5" style={{ lineHeight: 1.6, maxWidth: "65ch", textWrap: "pretty" }}>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </motion.div>
    </AnimatePresence>
  );
}
