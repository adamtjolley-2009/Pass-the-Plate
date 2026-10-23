import { useCallback, useEffect, useState } from "react";

export const DEFAULT_CATEGORIES = [
  "Breakfast",
  "2nd Breakfast",
  "Lunch",
  "Dinner",
  "Appetizers",
  "Desserts",
  "Dirty Sodas",
];

const STORAGE_KEY = "custom_categories_v1";

function readCustom(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeCustom(list: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("custom-categories-changed"));
}

export function useCategories() {
  const [custom, setCustom] = useState<string[]>(() => readCustom());

  useEffect(() => {
    const handler = () => setCustom(readCustom());
    window.addEventListener("custom-categories-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("custom-categories-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const all = [...DEFAULT_CATEGORIES, ...readCustom()].map((c) => c.toLowerCase());
    if (all.includes(trimmed.toLowerCase())) return false;
    const next = [...readCustom(), trimmed];
    writeCustom(next);
    return true;
  }, []);

  const removeCategory = useCallback((name: string) => {
    const next = readCustom().filter((c) => c !== name);
    writeCustom(next);
  }, []);

  const isCustom = useCallback(
    (name: string) => custom.includes(name),
    [custom]
  );

  return {
    categories: [...DEFAULT_CATEGORIES, ...custom],
    customCategories: custom,
    addCategory,
    removeCategory,
    isCustom,
  };
}
