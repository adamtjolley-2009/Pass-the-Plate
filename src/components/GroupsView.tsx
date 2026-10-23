import { useState } from "react";
import { useGroups, useCreateGroup, useAddGroupMember, useRemoveGroupMember } from "@/hooks/useGroups";
import { useFriends, ProfileResult } from "@/hooks/useFriends";
import { Plus, X, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function GroupsView() {
  const { data: groups = [], isLoading: loadingGroups } = useGroups();
  const { data: friends = [], isLoading: loadingFriends } = useFriends();
  const createGroup = useCreateGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupEmoji, setNewGroupEmoji] = useState("👥");
  const showDetail = isMobile && selectedGroupId;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const groupMembers = selectedGroup
    ? friends.filter((f) => selectedGroup.memberIds.includes(f.user_id))
    : [];
  const nonMembers = selectedGroup
    ? friends.filter((f) => !selectedGroup.memberIds.includes(f.user_id))
    : [];

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createGroup.mutate(
      { name: newGroupName.trim(), emoji: newGroupEmoji },
      {
        onSuccess: () => {
          setNewGroupName("");
          setShowNewGroup(false);
          toast.success("Group created");
        },
        onError: () => toast.error("Failed to create group"),
      }
    );
  };

  const renderFriendRow = (friend: ProfileResult) => {
    const initials = (friend.display_name || friend.username || "?").charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          {friend.avatar_url && <AvatarImage src={friend.avatar_url} />}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">
          {friend.display_name || friend.username || "User"}
        </span>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Groups List */}
      <div className={cn(
        "w-full md:w-[320px] shrink-0 overflow-y-auto border-r border-border p-4 space-y-3",
        showDetail && "hidden md:block"
      )}>
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Groups</h2>
          <button onClick={() => setShowNewGroup(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {showNewGroup && (
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              {["👨‍👩‍👧‍👦", "👩‍🍳", "🍕", "🥘", "👥", "❤️"].map((e) => (
                <button key={e} onClick={() => setNewGroupEmoji(e)} className={cn("rounded-lg p-1.5 text-lg transition-colors", newGroupEmoji === e ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted")}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateGroup} disabled={createGroup.isPending} className="flex-1 rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Create</button>
              <button onClick={() => setShowNewGroup(false)} className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">Cancel</button>
            </div>
          </div>
        )}

        {loadingGroups ? (
          <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No groups yet. Create one above.</p>
        ) : groups.map((group) => (
          <motion.button
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-shadow duration-200",
              selectedGroupId === group.id ? "bg-primary/10 shadow-card ring-1 ring-primary/20" : "bg-card shadow-card hover:shadow-card-hover"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
          >
            <span className="text-2xl">{group.emoji}</span>
            <div>
              <p className="font-display font-semibold text-foreground">{group.name}</p>
              <p className="text-xs text-muted-foreground">{group.memberIds.length} {group.memberIds.length === 1 ? "member" : "members"}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Group Detail */}
      <div className={cn("flex-1 overflow-hidden", isMobile && !showDetail && "hidden md:block")}>
        {selectedGroup ? (
          <div className="relative h-full overflow-y-auto p-6 lg:p-8">
            {isMobile && (
              <button onClick={() => setSelectedGroupId(null)} className="absolute top-3 left-3 z-10 rounded-lg bg-muted/80 backdrop-blur-sm p-2 text-foreground hover:bg-muted transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className={isMobile ? "pt-12" : ""}>
              <h1 className="font-display text-2xl font-semibold text-foreground">{selectedGroup.emoji} {selectedGroup.name}</h1>

              {/* Members */}
              <section className="mt-6">
                <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Members</h2>
                {groupMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet. Add friends below.</p>
                ) : (
                  <div className="space-y-2">
                    {groupMembers.map((m) => (
                      <div key={m.user_id} className="flex items-center justify-between rounded-xl bg-card p-3 shadow-card">
                        {renderFriendRow(m)}
                        <button
                          onClick={() => removeMember.mutate({ groupId: selectedGroup.id, friendUserId: m.user_id }, {
                            onSuccess: () => toast.success(`Removed ${m.display_name || m.username}`),
                            onError: () => toast.error("Failed to remove member"),
                          })}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Add Friends */}
              {nonMembers.length > 0 && (
                <section className="mt-6">
                  <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add Friends</h2>
                  <div className="space-y-2">
                    {nonMembers.map((f) => (
                      <div key={f.user_id} className="flex items-center justify-between rounded-xl bg-card p-3 shadow-card">
                        {renderFriendRow(f)}
                        <button
                          onClick={() => addMember.mutate({ groupId: selectedGroup.id, friendUserId: f.user_id }, {
                            onSuccess: () => toast.success(`Added ${f.display_name || f.username}`),
                            onError: () => toast.error("Failed to add member"),
                          })}
                          className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {friends.length === 0 && !loadingFriends && (
                <p className="mt-6 text-sm text-muted-foreground">Add friends first in the Friends tab to populate your groups.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-lg font-display font-medium text-muted-foreground">Select a group</p>
              <p className="mt-1 text-sm text-muted-foreground">Organize friends into categories</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
