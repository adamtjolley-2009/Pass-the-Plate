import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useProfile";
import { ProfileForm } from "./ProfileForm";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button variant="outline" onClick={signOut} className="w-full gap-2 text-destructive hover:text-destructive">
      <LogOut className="h-4 w-4" />
      Sign Out
    </Button>
  );
}

export function ProfileView() {
  const { data: profile, isLoading, isError, error, refetch, isFetching } = useMyProfile();

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Customize your Pass the Plate profile</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isError ? (
          <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-5">
            <p className="font-medium text-foreground">We couldn't load your profile.</p>
            <p className="break-words text-sm text-muted-foreground">
              {(error as { message?: string } | null)?.message || "Unknown error"}
            </p>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Trying again…" : "Try again"}
            </Button>
          </div>
        ) : (
          <ProfileForm
            initial={{
              firstName: profile?.first_name ?? "",
              lastName: profile?.last_name ?? "",
              username: profile?.username ?? "",
            }}
            submitLabel="Save Profile"
            onSaved={() => toast.success("Profile updated", { description: "Your changes have been saved." })}
          />
        )}

        <SignOutButton />

        {!isLoading && <DeleteAccountSection username={profile?.username ?? null} />}
      </div>
    </div>
  );
}
