import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Group {
  id: string;
  name: string;
  emoji: string;
  memberIds: string[]; // friend user_ids
}

export function useGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["groups", user?.id],
    queryFn: async (): Promise<Group[]> => {
      if (!user) return [];
      const { data: groups, error } = await supabase
        .from("groups")
        .select("id, name, emoji")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!groups || groups.length === 0) return [];

      const groupIds = groups.map((g) => g.id);
      const { data: members, error: mErr } = await supabase
        .from("group_members")
        .select("group_id, friend_user_id")
        .in("group_id", groupIds);
      if (mErr) throw mErr;

      return groups.map((g) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        memberIds: (members ?? [])
          .filter((m) => m.group_id === g.id)
          .map((m) => m.friend_user_id),
      }));
    },
    enabled: !!user,
  });
}

export function useCreateGroup() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, emoji }: { name: string; emoji: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("groups")
        .insert({ user_id: user.id, name, emoji });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, friendUserId }: { groupId: string; friendUserId: string }) => {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, friend_user_id: friendUserId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, friendUserId }: { groupId: string; friendUserId: string }) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("friend_user_id", friendUserId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}
