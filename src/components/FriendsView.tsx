import { useState } from "react";
import { useSearchProfiles, useFriendships, useAddFriend, useAcceptFriend, useRemoveFriend, ProfileResult } from "@/hooks/useFriends";
import { useFriendRecipes, useCopyRecipe } from "@/hooks/useRecipes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, UserMinus, UserCheck, Users, ArrowLeft, Plus, Clock, ChefHat, Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Recipe } from "@/lib/types";
import { RecipeDetail } from "./RecipeDetail";

export function FriendsView() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults = [], isLoading: searching } = useSearchProfiles(searchQuery);
  const { data: friendships, isLoading: loadingFriends } = useFriendships();
  const { friends = [], incoming = [], outgoing = [] } = friendships ?? {};
  const addFriend = useAddFriend();
  const acceptFriend = useAcceptFriend();
  const removeFriend = useRemoveFriend();
  const copyRecipe = useCopyRecipe();
  const isMobile = useIsMobile();

  const [selectedFriend, setSelectedFriend] = useState<ProfileResult | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const { data: friendRecipes = [], isLoading: loadingRecipes } = useFriendRecipes(selectedFriend?.user_id ?? null);

  const friendUserIds = new Set(friends.map((f) => f.user_id));
  const incomingIds = new Set(incoming.map((f) => f.user_id));
  const outgoingIds = new Set(outgoing.map((f) => f.user_id));
  const showFriendDetail = selectedFriend !== null;
  const showRecipeDetail = selectedRecipe !== null;
  const backToFriendLabel = selectedFriend
    ? `${selectedFriend.display_name || selectedFriend.username}'s recipes`
    : "Back";

  const nameOf = (profile: ProfileResult) => profile.display_name || profile.username || "user";

  const handleAdd = (profile: ProfileResult) => {
    addFriend.mutate(profile.user_id, {
      onSuccess: () => toast.success(`Friend request sent to ${nameOf(profile)}`),
      onError: () => toast.error("Failed to send friend request"),
    });
  };

  const handleAccept = (profile: ProfileResult) => {
    acceptFriend.mutate(profile.user_id, {
      onSuccess: () => toast.success(`You and ${nameOf(profile)} are now friends`),
      onError: () => toast.error("Failed to accept friend request"),
    });
  };

  // Unfriend, decline an incoming request, or cancel a sent one
  const handleRemove = (profile: ProfileResult, message: string) => {
    removeFriend.mutate(profile.user_id, {
      onSuccess: () => {
        if (selectedFriend?.user_id === profile.user_id) {
          setSelectedFriend(null);
          setSelectedRecipe(null);
        }
        toast.success(message);
      },
      onError: () => toast.error("Something went wrong. Please try again."),
    });
  };

  const handleCopyRecipe = (recipe: Recipe) => {
    if (!selectedFriend) return;
    const originalAuthorName =
      selectedFriend.display_name || selectedFriend.username || "Friend";
    copyRecipe.mutate(
      { recipe, originalAuthorName, originalAuthorId: selectedFriend.user_id },
      {
        onSuccess: () => toast.success(`"${recipe.title}" added to your library!`),
        onError: () => toast.error("Failed to add recipe"),
      }
    );
  };

  // Mobile: recipe detail view
  if (isMobile && showRecipeDetail && selectedRecipe) {
    return (
      <RecipeDetail recipe={selectedRecipe} readOnly onBack={() => setSelectedRecipe(null)} backLabel={backToFriendLabel} />
    );
  }

  // Mobile: friend detail (recipe list)
  if (isMobile && showFriendDetail && selectedFriend) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <button
          onClick={() => setSelectedFriend(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back to Friends</span>
        </button>
        <FriendRecipeList
          friend={selectedFriend}
          recipes={friendRecipes}
          loading={loadingRecipes}
          onSelectRecipe={setSelectedRecipe}
          onCopyRecipe={handleCopyRecipe}
          copyPending={copyRecipe.isPending}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Friends List Panel */}
      <div className={cn(
        "w-full md:w-[320px] shrink-0 overflow-y-auto border-r border-border p-4 space-y-4",
        isMobile && showFriendDetail && "hidden md:block"
      )}>
        {/* Search */}
        <div>
          <h2 className="px-1 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Friends
          </h2>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Results</h3>
            {searching ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No users found.</p>
            ) : (
              searchResults.map((profile) => {
                return (
                  <div key={profile.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
                    <FriendRow profile={profile} />
                    {friendUserIds.has(profile.user_id) ? (
                      <Button size="sm" variant="outline" onClick={() => handleRemove(profile, `Removed ${nameOf(profile)} from friends`)} disabled={removeFriend.isPending} className="gap-1 text-destructive hover:text-destructive h-8 text-xs">
                        <UserMinus className="h-3.5 w-3.5" /> Remove
                      </Button>
                    ) : incomingIds.has(profile.user_id) ? (
                      <Button size="sm" onClick={() => handleAccept(profile)} disabled={acceptFriend.isPending} className="gap-1 h-8 text-xs">
                        <UserCheck className="h-3.5 w-3.5" /> Accept
                      </Button>
                    ) : outgoingIds.has(profile.user_id) ? (
                      <Button size="sm" variant="outline" onClick={() => handleRemove(profile, "Friend request cancelled")} disabled={removeFriend.isPending} className="h-8 text-xs">
                        Requested
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleAdd(profile)} disabled={addFriend.isPending} className="gap-1 h-8 text-xs">
                        <UserPlus className="h-3.5 w-3.5" /> Add
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5" /> Friend Requests ({incoming.length})
            </h3>
            {incoming.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-card">
                <FriendRow profile={profile} />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => handleAccept(profile)} disabled={acceptFriend.isPending} className="h-8 text-xs">
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRemove(profile, "Friend request declined")} disabled={removeFriend.isPending} className="h-8 text-xs">
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sent requests */}
        {outgoing.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Sent Requests ({outgoing.length})
            </h3>
            {outgoing.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-card">
                <FriendRow profile={profile} />
                <Button size="sm" variant="outline" onClick={() => handleRemove(profile, "Friend request cancelled")} disabled={removeFriend.isPending} className="h-8 text-xs">
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Friend List */}
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> My Friends ({friends.length})
          </h3>
          {loadingFriends ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : friends.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No friends yet. Search above to add them!</p>
          ) : (
            friends.map((friend) => (
              <motion.button
                key={friend.id}
                onClick={() => { setSelectedFriend(friend); setSelectedRecipe(null); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl p-3 text-left transition-shadow",
                  selectedFriend?.user_id === friend.user_id
                    ? "bg-primary/10 shadow-card ring-1 ring-primary/20"
                    : "bg-card shadow-card hover:shadow-card-hover"
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              >
                <FriendRow profile={friend} />
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Detail Panel (desktop) */}
      <div className={cn("flex-1 overflow-hidden", isMobile && "hidden")}>
        {showRecipeDetail && selectedRecipe ? (
          <RecipeDetail recipe={selectedRecipe} readOnly onBack={() => setSelectedRecipe(null)} backLabel={backToFriendLabel} />
        ) : showFriendDetail && selectedFriend ? (
          <div className="h-full overflow-y-auto p-6 lg:p-8">
            <FriendRecipeList
              friend={selectedFriend}
              recipes={friendRecipes}
              loading={loadingRecipes}
              onSelectRecipe={setSelectedRecipe}
              onCopyRecipe={handleCopyRecipe}
              copyPending={copyRecipe.isPending}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-lg font-display font-medium text-muted-foreground">Select a friend</p>
              <p className="mt-1 text-sm text-muted-foreground">View their recipe library</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FriendRow({ profile }: { profile: ProfileResult }) {
  const initials = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-display font-semibold text-foreground text-sm">
          {profile.display_name || profile.username}
        </p>
        {profile.username && (
          <p className="text-xs text-muted-foreground">@{profile.username}</p>
        )}
      </div>
    </div>
  );
}

function FriendRecipeList({
  friend,
  recipes,
  loading,
  onSelectRecipe,
  onCopyRecipe,
  copyPending,
}: {
  friend: ProfileResult;
  recipes: Recipe[];
  loading: boolean;
  onSelectRecipe: (r: Recipe) => void;
  onCopyRecipe: (r: Recipe) => void;
  copyPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {friend.display_name || friend.username}'s Recipes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap a recipe to preview, or add it to your library
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ChefHat className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No recipes shared yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <motion.div
              key={recipe.id}
              className="group rounded-2xl bg-card shadow-card overflow-hidden cursor-pointer transition-shadow hover:shadow-card-hover"
              onClick={() => onSelectRecipe(recipe)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {recipe.imageUrl && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-display font-semibold text-foreground line-clamp-1">{recipe.title}</h3>
                {recipe.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {recipe.prepTime !== "—" && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{recipe.prepTime}</span>
                    )}
                    {recipe.tags.length > 0 && (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">{recipe.tags[0]}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    disabled={copyPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyRecipe(recipe);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
