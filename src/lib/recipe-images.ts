// Public URL of a photo in our recipe-images bucket -> its storage path
export function recipeImagePath(url: string | undefined): string | null {
  const marker = "/storage/v1/object/public/recipe-images/";
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}
