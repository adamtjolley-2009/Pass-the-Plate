import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "./Login";

const signUp = vi.fn();
const signInWithOAuth = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

function submitSignUp() {
  render(<Login />);
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "abcdef" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
}

describe("Login sign up", () => {
  beforeEach(() => vi.clearAllMocks());

  it("doesn't ask to check email when sign-up signs the user in", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
    submitSignUp();
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("asks to check email when confirmation is required", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    submitSignUp();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Check your email", expect.anything()));
  });
});

describe("Login with Google", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts Google sign-in through Supabase and returns to the app", async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      })
    );
  });

  it("has no Apple sign-in", () => {
    render(<Login />);
    expect(screen.queryByRole("button", { name: /Apple/ })).not.toBeInTheDocument();
  });

  it("hides Google sign-in on the forgot-password screen", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });
});
