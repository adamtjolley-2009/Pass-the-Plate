-- handle_new_user only runs as a trigger; nobody should call it through the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- One SELECT policy on profiles instead of two (faster: evaluated once per row)
DROP POLICY "Users can view their own profile" ON public.profiles;
DROP POLICY "Users can view connected profiles" ON public.profiles;
CREATE POLICY "Users can view their own and connected profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.user_id = (SELECT auth.uid()) AND f.friend_id = profiles.user_id)
         OR (f.friend_id = (SELECT auth.uid()) AND f.user_id = profiles.user_id)
    )
  );
