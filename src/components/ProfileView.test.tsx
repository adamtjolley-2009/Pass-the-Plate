import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileView } from "./ProfileView";

const refetch = vi.fn();

vi.mock("@/hooks/useProfile", () => ({
  useMyProfile: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    isFetching: false,
    error: { message: 'column profiles.first_name does not exist' },
    refetch,
  }),
  useSaveProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAccount: () => ({ mutate: vi.fn(), isPending: false }),
  UsernameTakenError: class extends Error {},
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));

describe("ProfileView", () => {
  it("shows the error, a retry button, and still offers sign out and delete", () => {
    render(<ProfileView />);
    expect(screen.getByRole("alert")).toHaveTextContent("first_name does not exist");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Account" })).toBeInTheDocument();
  });
});
