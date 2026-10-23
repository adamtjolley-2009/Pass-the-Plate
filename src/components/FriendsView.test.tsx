import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FriendsView } from "./FriendsView";
import type { ProfileResult } from "@/hooks/useFriends";

const profile = (id: string, name: string): ProfileResult => ({
  id: `p-${id}`,
  user_id: id,
  username: name.toLowerCase(),
  display_name: name,
  first_name: name,
  last_name: null,
  avatar_url: null,
});

const sam = profile("u-sam", "Sam");
const riley = profile("u-riley", "Riley");
const jo = profile("u-jo", "Jo");

const addFriend = vi.fn();
const acceptFriend = vi.fn();
const removeFriend = vi.fn();
const mutation = (mutate: typeof addFriend) => ({ mutate, isPending: false });

vi.mock("@/hooks/useFriends", () => ({
  useSearchProfiles: () => ({ data: [], isLoading: false }),
  useFriendships: () => ({
    data: { friends: [sam], incoming: [riley], outgoing: [jo] },
    isLoading: false,
  }),
  useAddFriend: () => mutation(addFriend),
  useAcceptFriend: () => mutation(acceptFriend),
  useRemoveFriend: () => mutation(removeFriend),
}));

vi.mock("@/hooks/useRecipes", () => ({
  useFriendRecipes: () => ({ data: [], isLoading: false }),
  useCopyRecipe: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("FriendsView friend requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists friends, incoming and sent requests separately", () => {
    render(<FriendsView />);
    expect(screen.getByText("Friend Requests (1)")).toBeInTheDocument();
    expect(screen.getByText("Sent Requests (1)")).toBeInTheDocument();
    expect(screen.getByText("My Friends (1)")).toBeInTheDocument();
  });

  it("accepts and declines incoming requests", () => {
    render(<FriendsView />);
    const row = screen.getByText("Riley").closest("div.rounded-2xl") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Accept" }));
    expect(acceptFriend).toHaveBeenCalledWith("u-riley", expect.anything());
    fireEvent.click(within(row).getByRole("button", { name: "Decline" }));
    expect(removeFriend).toHaveBeenCalledWith("u-riley", expect.anything());
  });

  it("cancels a sent request", () => {
    render(<FriendsView />);
    const row = screen.getByText("Jo").closest("div.rounded-2xl") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    expect(removeFriend).toHaveBeenCalledWith("u-jo", expect.anything());
  });
});
