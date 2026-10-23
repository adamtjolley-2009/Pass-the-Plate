import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProfileNames } from "@/lib/profile";

export function useMyProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, first_name, last_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    // Fail fast so a missing column or policy shows an error instead of a long spinner
    retry: 1,
  });
}

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken.");
  }
}

export function useSaveProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ firstName, lastName, username }: ProfileNames) => {
      if (!user) throw new Error("Not authenticated");
      const first_name = firstName.trim();
      const last_name = lastName.trim();
      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          first_name,
          last_name,
          display_name: `${first_name} ${last_name}`,
          username,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        if (error.code === "23505") throw new UsernameTakenError();
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}

// Permanently deletes the signed-in user's account and everything they own
export function useDeleteAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Recipe photos live under "<user id>/" and must go through the Storage API
      const bucket = supabase.storage.from("recipe-images");
      for (;;) {
        const { data: files, error } = await bucket.list(user.id, { limit: 100 });
        if (error) throw error;
        if (!files || files.length === 0) break;
        const { data: removed, error: removeError } = await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
        if (removeError) throw removeError;
        if (!removed || removed.length === 0) throw new Error("Couldn't delete your recipe photos");
      }

      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
    },
    onSuccess: async () => {
      // The account no longer exists, so only clear the session in this browser
      await supabase.auth.signOut({ scope: "local" });
      queryClient.clear();
    },
  });
}
