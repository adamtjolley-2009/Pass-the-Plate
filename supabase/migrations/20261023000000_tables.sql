-- Pass the Plate: complete database schema.
-- Consolidated from the original app's migrations into their final state.

-- ============================================================
-- Tables
-- ============================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  -- "First Last", kept in sync by the app; used wherever a name is shown
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  dietary_preferences TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  prep_time TEXT,
  cook_time TEXT,
  base_servings INTEGER NOT NULL DEFAULT 4,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps TEXT[] DEFAULT '{}',
  substitutes JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  -- Set when the recipe was copied from a friend
  original_author_name TEXT,
  original_author_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recipes_user_id_idx ON public.recipes (user_id);

-- One row per pair of users: user_id sent the request, friend_id accepts it.
-- Accepted friendships are mutual.
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CONSTRAINT friendships_not_self CHECK (user_id <> friend_id)
);
CREATE UNIQUE INDEX friendships_pair_unique
  ON public.friendships (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));
CREATE INDEX friendships_friend_id_idx ON public.friendships (friend_id);

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '👥',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX groups_user_id_idx ON public.groups (user_id);

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  friend_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, friend_user_id)
);
CREATE INDEX group_members_friend_user_id_idx ON public.group_members (friend_user_id);
