import { ChefHat } from "lucide-react";
import { ProfileForm } from "@/components/ProfileForm";
import { useAuth } from "@/hooks/useAuth";

interface CompleteProfileProps {
  profile: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null;
}

// Shown after sign-in until the user has a first name, last name and username
const CompleteProfile = ({ profile }: CompleteProfileProps) => {
  const { signOut } = useAuth();

  // Prefill from the name a sign-in provider gave us, e.g. "Sam Jones"
  const [guessFirst = "", ...guessRest] =
    profile?.display_name && profile.display_name !== "Chef" ? profile.display_name.trim().split(/\s+/) : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ChefHat className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Set up your profile</h1>
          <p className="text-sm text-muted-foreground">
            Tell us your name and pick a username so friends can find you.
          </p>
        </div>

        <ProfileForm
          initial={{
            firstName: profile?.first_name ?? guessFirst,
            lastName: profile?.last_name ?? guessRest.join(" "),
            username: profile?.username ?? "",
          }}
          submitLabel="Continue"
        />

        <p className="text-center text-sm text-muted-foreground">
          Wrong account?{" "}
          <button type="button" onClick={signOut} className="font-medium text-primary hover:underline">
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
};

export default CompleteProfile;
