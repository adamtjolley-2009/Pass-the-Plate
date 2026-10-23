import { Book, Users, UsersRound, Plus, ChefHat, UserCircle } from "lucide-react";
import { useRecipeStore } from "@/lib/recipe-store";
import { cn } from "@/lib/utils";
import { useFriendships } from "@/hooks/useFriends";

const navItems = [
  { id: "library" as const, label: "My Library", icon: Book },
  { id: "friends" as const, label: "Friends", icon: Users },
  { id: "groups" as const, label: "Groups", icon: UsersRound },
  { id: "add" as const, label: "Add Recipe", icon: Plus },
  { id: "profile" as const, label: "My Profile", icon: UserCircle },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { activeView, setActiveView } = useRecipeStore();
  const { data: friendships } = useFriendships();
  const pendingRequests = friendships?.incoming.length ?? 0;

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col bg-muted border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <ChefHat className="h-6 w-6 text-primary" />
        <span className="font-display text-lg font-bold text-foreground tracking-tight">Pass the Plate</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveView(item.id); onNavigate?.(); }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              activeView === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
            {item.id === "friends" && pendingRequests > 0 && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold",
                  activeView === item.id ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                )}
                aria-label={`${pendingRequests} pending friend requests`}
              >
                {pendingRequests}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">Your recipes, organized.</p>
      </div>
    </aside>
  );
}
