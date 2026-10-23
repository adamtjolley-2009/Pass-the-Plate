import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteAccountSection } from "./DeleteAccountSection";

const mutate = vi.fn();

vi.mock("@/hooks/useProfile", () => ({
  useDeleteAccount: () => ({ mutate, isPending: false }),
}));

describe("DeleteAccountSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only deletes after the username is typed", () => {
    render(<DeleteAccountSection username="samcooks" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));

    const confirm = screen.getByRole("button", { name: "Delete my account" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "samcook" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "samcooks" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("asks for DELETE when there is no username", () => {
    render(<DeleteAccountSection username={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(screen.getByText("DELETE")).toBeInTheDocument();
  });
});
