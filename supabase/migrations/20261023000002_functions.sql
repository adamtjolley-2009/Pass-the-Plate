-- ============================================================
-- Functions and triggers
-- ============================================================
-- Create a profile for every new user, prefilling names from Google when available
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Chef'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    NEW.raw_user_meta_data->>'given_name',
    NEW.raw_user_meta_data->>'family_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Friend search by first name, last name or username. Every word in the query
-- must match one of them, so "sam jones" finds Sam Jones and "samcooks" finds @samcooks.
CREATE OR REPLACE FUNCTION public.search_profiles(_query text)
RETURNS TABLE (id uuid, user_id uuid, username text, display_name text, first_name text, last_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH words AS (
    SELECT replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') AS pattern
    FROM unnest(regexp_split_to_array(lower(trim(_query)), '\s+')) AS w
    WHERE w <> ''
    LIMIT 4
  )
  SELECT p.id, p.user_id, p.username, p.display_name, p.first_name, p.last_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(trim(_query)) >= 2
    AND p.user_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM words
      WHERE NOT (
        p.username ILIKE '%' || words.pattern || '%'
        OR p.first_name ILIKE '%' || words.pattern || '%'
        OR p.last_name ILIKE '%' || words.pattern || '%'
      )
    )
  ORDER BY p.first_name NULLS LAST, p.username
  LIMIT 20
$$;

REVOKE ALL ON FUNCTION public.search_profiles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(text) TO authenticated;

-- Permanently deletes the signed-in user's account. Profile, recipes,
-- friendships, groups and group memberships are removed by ON DELETE CASCADE.
-- Recipe photos are removed by the app through the Storage API beforehand.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
