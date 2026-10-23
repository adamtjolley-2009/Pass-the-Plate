export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  originalQuantity: number;
}

export interface Substitute {
  original: string;
  replacement: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  baseServings: number;
  currentServings: number;
  ingredients: Ingredient[];
  steps: string[];
  substitutes?: Substitute[];
  tags: string[];
  author: string;
  authorId?: string;
  imageUrl?: string;
  isFavorite?: boolean;
}
