import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel";

const push = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
  })
}));

describe("AuthPanel", () => {
  beforeEach(() => {
    push.mockReset();
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: "csrf-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message: "If the request can be processed, a verification message will be sent." })
      });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("submits a registration request with CSRF protection", async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.click(screen.getByRole("tab", { name: /register/i }));
    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "StrongPassword123");
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/verification message/i)).toBeInTheDocument();
    });

    const registerCall = fetchMock.mock.calls[1] as [string, RequestInit] | undefined;
    expect(registerCall).toBeDefined();
    if (!registerCall) {
      throw new Error("Expected register fetch call.");
    }
    const [url, init] = registerCall;
    expect(url).toContain("/api/auth/register");
    expect((init.headers as Headers).get("x-csrf-token")).toBe("csrf-token");
  });
});
