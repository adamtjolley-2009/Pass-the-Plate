import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/ingredients";

interface IngredientItemProps {
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  onToggle: () => void;
}

export function IngredientItem({ name, quantity, unit, checked, onToggle }: IngredientItemProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
        checked && "opacity-50"
      )}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", duration: 0.2, bounce: 0 }}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
          checked
            ? "border-primary bg-primary"
            : "border-border bg-background"
        )}
      >
        {checked && (
          <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <span className={cn("tabular-nums font-medium text-foreground min-w-[3.5rem]", checked && "line-through")}>
        {formatQuantity(quantity)} {unit}
      </span>

      <span className={cn("font-body text-foreground", checked && "line-through")}>
        {name}
      </span>
    </motion.button>
  );
}
