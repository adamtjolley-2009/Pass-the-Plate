import { useState, useRef } from "react";
import { useRecipeStore } from "@/lib/recipe-store";
import { useAddRecipe, useUpdateRecipe } from "@/hooks/useRecipes";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Recipe, Substitute } from "@/lib/types";
import { parseIngredientLine, ingredientToLine } from "@/lib/ingredients";
import { ImagePlus, X, Link, Loader2 } from "lucide-react";

// Public URL of a photo in our recipe-images bucket -> its storage path
function recipeImagePath(url: string | undefined): string | null {
  const marker = "/storage/v1/object/public/recipe-images/";
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

const timeOrEmpty = (value: string) => (value === "—" ? "" : value);

// With `recipe`, the form edits that recipe instead of adding a new one
export function AddRecipeView({ recipe }: { recipe?: Recipe } = {}) {
  const { setActiveView, stopEditing } = useRecipeStore();
  const { user } = useAuth();
  const addRecipeMutation = useAddRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const saving = addRecipeMutation.isPending || updateRecipeMutation.isPending;
  const { categories, addCategory } = useCategories();
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [prepTime, setPrepTime] = useState(recipe ? timeOrEmpty(recipe.prepTime) : "");
  const [cookTime, setCookTime] = useState(recipe ? timeOrEmpty(recipe.cookTime) : "");
  const [servings, setServings] = useState(String(recipe?.baseServings ?? 4));
  const [ingredientsText, setIngredientsText] = useState(recipe?.ingredients.map(ingredientToLine).join("\n") ?? "");
  const [stepsText, setStepsText] = useState(recipe?.steps.join("\n") ?? "");
  const [substitutesText, setSubstitutesText] = useState(
    recipe?.substitutes?.map((s) => (s.replacement ? `${s.original} → ${s.replacement}` : s.original)).join("\n") ?? ""
  );
  const [category, setCategory] = useState(recipe?.tags[0] ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  // An existing photo's URL, or a blob: URL for a newly picked file
  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recipeUrl, setRecipeUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedText, setPastedText] = useState("");

  // Sends a link (or pasted page text) to the importer and fills in the form
  const runImport = async (body: { url: string } | { text: string }) => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-recipe-url", { body });
      if (error) {
        // The function explains what went wrong in its response body
        const details = await (error as { context?: Response }).context?.json?.().catch(() => null);
        if (details?.code === "blocked" || details?.code === "no_recipe") setShowPaste(true);
        throw new Error(details?.error || "Couldn't import that recipe. Please try again.");
      }
      if (!data?.success || !data?.recipe) throw new Error(data?.error || "Couldn't find a recipe on that page.");

      const r = data.recipe;
      if (r.title) setTitle(r.title);
      if (r.description) setDescription(r.description);
      if (r.prepTime) setPrepTime(r.prepTime);
      if (r.cookTime) setCookTime(r.cookTime);
      if (r.servings) setServings(String(r.servings));
      if (r.ingredients?.length) setIngredientsText(r.ingredients.join("\n"));
      if (r.steps?.length) setStepsText(r.steps.join("\n"));
      if (r.substitutes?.length) {
        setSubstitutesText(
          r.substitutes.map((s: Substitute) => `${s.original} → ${s.replacement}`).join("\n")
        );
      }
      if (r.category && categories.includes(r.category)) setCategory(r.category);
      setShowPaste(false);
      setPastedText("");
      toast.success("Recipe imported! Review and save when ready.");
    } catch (err) {
      console.error("Import error:", err);
      toast.error(err instanceof Error && err.message ? err.message : "Failed to import recipe");
    } finally {
      setImporting(false);
    }
  };

  const handleImportUrl = () => {
    if (!recipeUrl.trim()) return;
    // Accept links pasted without "https://", e.g. "allrecipes.com/recipe/..."
    const url = /^https?:\/\//i.test(recipeUrl.trim()) ? recipeUrl.trim() : `https://${recipeUrl.trim()}`;
    runImport({ url });
  };

  const handleImportText = () => {
    if (pastedText.trim()) runImport({ text: pastedText });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a recipe title");
      return;
    }

    const ingredients = ingredientsText
      .split("\n")
      .filter((l) => l.trim())
      .map(parseIngredientLine);

    const steps = stepsText.split("\n").filter((l) => l.trim());
    const substitutes = substitutesText
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.split("→").length > 1 ? line.split("→") : line.split("->");
        return {
          original: (parts[0] || line).trim(),
          replacement: (parts[1] || "").trim(),
        };
      });
    const baseServings = parseInt(servings) || 4;

    // Keep the current photo unless it was removed or replaced
    let imageUrl: string | undefined = imagePreview && !imageFile ? imagePreview : undefined;
    if (imageFile && user) {
      setUploading(true);
      const ext = imageFile.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, imageFile);
      if (uploadError) {
        toast.error("Failed to upload image");
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("recipe-images")
        .getPublicUrl(path);
      imageUrl = urlData.publicUrl;
      setUploading(false);
    }

    const saved: Recipe = {
      ...recipe,
      id: recipe?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      prepTime: prepTime || "—",
      cookTime: cookTime || "—",
      baseServings,
      currentServings: baseServings,
      ingredients,
      steps,
      substitutes,
      tags: category ? [category] : [],
      author: recipe?.author ?? "You",
      imageUrl,
    };

    try {
      if (recipe) {
        await updateRecipeMutation.mutateAsync(saved);
        // Best effort: delete the old photo if it was replaced or removed
        const oldPath = recipeImagePath(recipe.imageUrl);
        if (oldPath && recipe.imageUrl !== imageUrl) {
          await supabase.storage.from("recipe-images").remove([oldPath]);
        }
        toast.success("Recipe updated!");
        stopEditing();
      } else {
        await addRecipeMutation.mutateAsync(saved);
        toast.success("Recipe added!");
        setActiveView("library");
      }
    } catch {
      toast.error("Failed to save recipe. Please try again.");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <h1
        className="font-display font-semibold text-foreground mb-6"
        style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", letterSpacing: "-0.03em" }}
      >
        {recipe ? "Edit Recipe" : "Add Recipe"}
      </h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {/* URL import (new recipes only) */}
        {!recipe && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Import from URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={recipeUrl}
                  onChange={(e) => setRecipeUrl(e.target.value)}
                  placeholder="Paste a recipe URL..."
                  className={inputClass + " pl-9"}
                />
              </div>
              <button
                type="button"
                onClick={handleImportUrl}
                disabled={importing || !recipeUrl.trim()}
                className="h-[46px] rounded-xl bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste a URL from any recipe site to auto-fill the form
              {!showPaste && (
                <>
                  {" "}or{" "}
                  <button type="button" onClick={() => setShowPaste(true)} className="font-medium text-primary hover:underline">
                    paste the recipe text
                  </button>
                </>
              )}
            </p>

            {showPaste && (
              <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
                <label htmlFor="pasted-recipe" className="block text-sm font-medium text-foreground">
                  Paste recipe text
                </label>
                <p className="text-xs text-muted-foreground">
                  Some sites block imports. Open the recipe, select all (Ctrl+A or ⌘A), copy, and paste it here.
                </p>
                <textarea
                  id="pasted-recipe"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={6}
                  placeholder="Paste the recipe page here..."
                  className={inputClass + " resize-y"}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleImportText}
                    disabled={importing || !pastedText.trim()}
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {importing ? "Reading..." : "Read recipe"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaste(false);
                      setPastedText("");
                    }}
                    className="h-10 rounded-xl border border-input px-4 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative w-full max-w-xs">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-48 w-full rounded-xl object-cover border border-border"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-48 w-full max-w-xs items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <div className="flex flex-col items-center gap-2">
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm">Add a photo</span>
              </div>
            </button>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Classic Pasta Carbonara" className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short description" className={inputClass} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Prep Time</label>
            <input value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="10 min" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Cook Time</label>
            <input value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="20 min" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Servings</label>
            <input value={servings} onChange={(e) => setServings(e.target.value)} type="number" min="1" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Ingredients <span className="text-muted-foreground font-normal">(one per line, e.g. "400 g spaghetti")</span>
          </label>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={6}
            placeholder={"400 g spaghetti\n200 g guanciale\n6 egg yolks"}
            className={inputClass + " resize-y"}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Substitutes <span className="text-muted-foreground font-normal">(one per line, e.g. "Greek yogurt → sour cream")</span>
          </label>
          <textarea
            value={substitutesText}
            onChange={(e) => setSubstitutesText(e.target.value)}
            rows={4}
            placeholder={"Greek yogurt → sour cream\nHoney → maple syrup"}
            className={inputClass + " resize-y"}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Steps <span className="text-muted-foreground font-normal">(one per line)</span>
          </label>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={6}
            placeholder={"Bring a large pot of salted water to a boil.\nCook spaghetti until al dente."}
            className={inputClass + " resize-y"}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => {
              if (e.target.value === "__add_new__") {
                setAddingCategory(true);
                return;
              }
              setCategory(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="__add_new__">+ Add new category…</option>
          </select>
          {addingCategory && (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  const name = newCategory.trim();
                  if (!name) return;
                  const ok = addCategory(name);
                  if (!ok) {
                    toast.error("Category already exists");
                    return;
                  }
                  setCategory(name);
                  setNewCategory("");
                  setAddingCategory(false);
                  toast.success(`Added "${name}"`);
                }}
                className="h-[46px] rounded-xl bg-primary px-4 font-medium text-primary-foreground hover:opacity-90"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategory("");
                }}
                className="h-[46px] rounded-xl border border-input px-4 font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || uploading}
            className="h-11 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Uploading image..." : saving ? "Saving..." : recipe ? "Save Changes" : "Save Recipe"}
          </button>
          {recipe && (
            <button
              type="button"
              onClick={stopEditing}
              disabled={saving || uploading}
              className="h-11 rounded-xl border border-input px-6 font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
