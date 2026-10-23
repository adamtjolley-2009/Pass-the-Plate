import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ProfileResult {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface Friendships {
  friends: ProfileResult[];
  // Requests other people sent to me, waiting for my approval
  incoming: ProfileResult[];
  // Requests I sent, waiting for the other person
  outgoing: ProfileResult[];
}

const PROFILE_COLUMNS = "id, user_id, username, display_name, first_name, last_name, avatar_url";

export function useSearchProfiles(query: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["search-profiles", query],
    queryFn: async () => {
      if (!user || !query.trim()) return [];
      // Profiles are private to connections, so search goes through a database
      // function. Every word must match a first name, last name or username.
      const { data, error } = await supabase.rpc("search_profiles", { _query: query.trim() });
      if (error) throw error;
      return data as ProfileResult[];
    },
    enabled: !!user && query.trim().length >= 2,
  });
}

// A friendship is one row per pair of users: user_id sent the request and
// friend_id accepts it. Accepted friendships are mutual.
function useFriendshipsQuery<T>(select: (data: Friendships) => T) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: async (): Promise<Friendships> => {
      const empty: Friendships = { friends: [], incoming: [], outgoing: [] };
      if (!user) return empty;
      const { data: rows, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      if (error) throw error;
      if (!rows || rows.length === 0) return empty;

      const otherId = (r: (typeof rows)[number]) => (r.user_id === user.id ? r.friend_id : r.user_id);
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .in("user_id", rows.map(otherId));
      if (pError) throw pError;

      const byUserId = new Map((profiles ?? []).map((p) => [p.user_id, p as ProfileResult]));
      const result: Friendships = { friends: [], incoming: [], outgoing: [] };
      for (const row of rows) {
        const profile = byUserId.get(otherId(row));
        if (!profile) continue;
        if (row.status === "accepted") result.friends.push(profile);
        else if (row.friend_id === user.id) result.incoming.push(profile);
        else result.outgoing.push(profile);
      }
      return result;
    },
    enabled: !!user,
    select,
  });
}

export function useFriendships() {
  return useFriendshipsQuery((data) => data);
}

export function useFriends() {
  return useFriendshipsQuery((data) => data.friends);
}

export function useAddFriend() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendUserId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("friendships")
        .insert({ user_id: user.id, friend_id: friendUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
    },
  });
}

export function useAcceptFriend() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requesterUserId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", requesterUserId)
        .eq("friend_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
    },
  });
}

// Removes the friendship in either direction: unfriend, decline or cancel a request.
export function useRemoveFriend() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendUserId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("friendships")
        .delete()
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      queryClient.invalidateQueries({ queryKey: ["friend-recipes"] });
    },
  });
}
