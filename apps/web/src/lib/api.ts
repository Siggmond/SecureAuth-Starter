type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  emailVerifiedAt: string | null;
};

export type DevEmail = {
  id: string;
  to: string;
  type: "password-reset" | "email-verification";
  subject: string;
  createdAt: string;
  token: string;
  url: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let cachedCsrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
  }
}

export function rememberCsrfToken(token: string): void {
  cachedCsrfToken = token;
}

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  const response = await fetch(`${API_URL}/api/auth/csrf-token`, {
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new ApiError("Could not start a secure session.", response.status);
  }

  const body = (await response.json()) as { csrfToken: string };
  cachedCsrfToken = body.csrfToken;
  return body.csrfToken;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);

  if (method !== "GET" && method !== "HEAD") {
    headers.set("content-type", "application/json");
    headers.set("x-csrf-token", await getCsrfToken());
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store"
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody | T;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new ApiError(errorBody.error?.message ?? "Request failed.", response.status, errorBody.error?.code);
  }

  return body as T;
}
