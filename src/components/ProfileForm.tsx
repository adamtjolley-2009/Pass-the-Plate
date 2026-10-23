import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSaveProfile, UsernameTakenError } from "@/hooks/useProfile";
import { normalizeUsername, validateProfileNames, ProfileNames, USERNAME_MIN, USERNAME_MAX } from "@/lib/profile";

interface ProfileFormProps {
  initial: ProfileNames;
  submitLabel: string;
  onSaved?: () => void;
}

export function ProfileForm({ initial, submitLabel, onSaved }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [username, setUsername] = useState(normalizeUsername(initial.username));
  const [error, setError] = useState<string | null>(null);
  const saveProfile = useSaveProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = { firstName, lastName, username };
    const invalid = validateProfileNames(fields);
    setError(invalid);
    if (invalid) return;

    try {
      await saveProfile.mutateAsync(fields);
      onSaved?.();
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        setError(err.message);
      } else {
        toast.error("Couldn't save your profile", { description: err instanceof Error ? err.message : undefined });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first-name">First name</Label>
          <Input
            id="first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            maxLength={50}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">Last name</Label>
          <Input
            id="last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            maxLength={50}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            placeholder="yourusername"
            autoComplete="username"
            autoCapitalize="none"
            className="pl-8"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {USERNAME_MIN}–{USERNAME_MAX} characters: letters, numbers and underscores. Friends can find you by your
          name or username.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="h-11 w-full" disabled={saveProfile.isPending}>
        {saveProfile.isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
