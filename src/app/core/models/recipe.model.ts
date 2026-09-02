export interface RecipeItem {
  materialId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  productId: string;
  items: RecipeItem[];
  /** Legacy demo recipe flag — set by the master data migration; never deleted. */
  demo?: boolean;
  createdAt: string;
  updatedAt?: string;
}
