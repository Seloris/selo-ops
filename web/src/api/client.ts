import createClient from "openapi-fetch";
import type { paths } from "./schema.d.ts";

// The only place that calls fetch; `/api` is proxied to the API by Vite in development.
export const api = createClient<paths>({ baseUrl: "/api" });

// RFC 9457 body the API sends on every error (`application/problem+json`).
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

// The text to show for a failed call: the problem's detail, else its title. A body that is not problem
// details (the API down behind the proxy) gives an empty string: the caller shows its own message.
export function problemMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const problem = error as Partial<ProblemDetails>;
    return problem.detail ?? problem.title ?? "";
  }
  return "";
}
