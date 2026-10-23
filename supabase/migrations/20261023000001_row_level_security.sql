-- ============================================================
-- Row level security
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Profiles: your own, plus anyone you have a friendship row with (any status).
-- Everyone else is found through search_profiles().
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view connected profiles" ON public.profiles
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.user_id = (SELECT auth.uid()) AND f.friend_id = profiles.user_id)
       OR (f.friend_id = (SELECT auth.uid()) AND f.user_id = profiles.user_id)
  ));
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Recipes: owners have full access; accepted friends (either direction) can read.
CREATE POLICY "Users and their friends can view recipes" ON public.recipes
  FOR SELECT TO authenticated USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted' AND (
        (f.user_id = (SELECT auth.uid()) AND f.friend_id = recipes.user_id)
        OR (f.friend_id = (SELECT auth.uid()) AND f.user_id = recipes.user_id)
      )
    )
  );
CREATE POLICY "Users can insert their own recipes" ON public.recipes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own recipes" ON public.recipes
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own recipes" ON public.recipes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Friendships
CREATE POLICY "Users can view friendships they are part of" ON public.friendships
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = friend_id);
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'pending');
CREATE POLICY "Recipients can accept friend requests" ON public.friendships
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = friend_id)
  WITH CHECK ((SELECT auth.uid()) = friend_id AND status = 'accepted');
-- Covers unfriending, declining a request and cancelling a sent request
CREATE POLICY "Either user can remove a friendship" ON public.friendships
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = friend_id);

-- Only status may be updated, so accepting can't change who the request is between
REVOKE UPDATE ON public.friendships FROM anon, authenticated;
GRANT UPDATE (status) ON public.friendships TO authenticated;

-- Groups
CREATE POLICY "Users can view their own groups" ON public.groups
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create their own groups" ON public.groups
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own groups" ON public.groups
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own groups" ON public.groups
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view members of their groups" ON public.group_members
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Users can add members to their groups" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Users can remove members from their groups" ON public.group_members
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.user_id = (SELECT auth.uid())
  ));
