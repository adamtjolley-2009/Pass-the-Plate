import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ServingStepperProps {
  servings: number;
  onChange: (servings: number) => void;
}

export function ServingStepper({ servings, onChange }: ServingStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(1, servings - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Decrease servings"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={servings}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="tabular-nums text-lg font-semibold text-foreground"
          >
            {servings}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-muted-foreground">
          {servings === 1 ? "serving" : "servings"}
        </span>
      </div>

      <button
        onClick={() => onChange(servings + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Increase servings"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
