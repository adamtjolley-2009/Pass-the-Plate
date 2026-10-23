import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import { Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe;
  isSelected: boolean;
  onClick: () => void;
}

export function RecipeCard({ recipe, isSelected, onClick }: RecipeCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl p-4 transition-shadow duration-200",
        isSelected
          ? "bg-primary/10 shadow-card ring-1 ring-primary/20"
          : "bg-card shadow-card hover:shadow-card-hover"
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
    >
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-32 object-cover rounded-xl mb-3"
        />
      )}
      <h3 className="font-display text-base font-semibold text-foreground leading-tight">
        {recipe.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2 font-body">
        {recipe.description}
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {recipe.prepTime}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {recipe.baseServings}
        </span>
        {recipe.author && recipe.author !== "You" && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
            by {recipe.author}
          </span>
        )}
      </div>
    </motion.button>
  );
}
