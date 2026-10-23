import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useDeleteAccount } from "@/hooks/useProfile";

// The user types this to confirm, so an account can't be deleted by a stray click
export function DeleteAccountSection({ username }: { username: string | null }) {
  const confirmText = username || "DELETE";
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const deleteAccount = useDeleteAccount();

  const handleDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => toast.success("Your account has been deleted"),
      onError: (err) =>
        toast.error("Couldn't delete your account", {
          description: err instanceof Error ? err.message : "Please try again.",
        }),
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-destructive/30 p-5">
      <div>
        <h2 className="font-display text-base font-semibold text-destructive">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your profile, recipes, photos, friends and groups. This can't be undone.
        </p>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (deleteAccount.isPending) return;
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full gap-2 border-destructive/40 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your profile, all of your recipes and photos, your friendships and your groups.
              Recipes friends already added to their own libraries stay with them.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAccount.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={typed.trim() !== confirmText || deleteAccount.isPending}
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
