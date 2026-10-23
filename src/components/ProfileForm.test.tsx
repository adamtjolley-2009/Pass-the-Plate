import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileForm } from "./ProfileForm";

const mutateAsync = vi.fn();

vi.mock("@/hooks/useProfile", () => ({
  useSaveProfile: () => ({ mutateAsync, isPending: false }),
  UsernameTakenError: class UsernameTakenError extends Error {},
}));

const empty = { firstName: "", lastName: "", username: "" };

describe("ProfileForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a name and a valid username before saving", () => {
    render(<ProfileForm initial={empty} submitLabel="Continue" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("first name");

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Jones" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "SJ" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 3");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("cleans up the username as it's typed and saves", async () => {
    const onSaved = vi.fn();
    render(<ProfileForm initial={{ ...empty, firstName: "Sam", lastName: "Jones" }} submitLabel="Continue" onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Sam.Cooks!" } });
    expect(screen.getByLabelText("Username")).toHaveValue("samcooks");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith({ firstName: "Sam", lastName: "Jones", username: "samcooks" });
  });
});
