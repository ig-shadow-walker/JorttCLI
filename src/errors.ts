/** Exit codes. Agents branch on these, so never renumber them. */
export const Exit = {
  OK: 0,
  /** Usage, validation (422) or other error. */
  ERROR: 1,
  /** A write was turned into a plan; nothing was sent. */
  PLAN: 2,
  /** Missing credentials, or Jortt rejected them / the token. */
  AUTH: 3,
  /** Credentials lack the scope or permission for this action. */
  FORBIDDEN: 4,
  /** Jortt unavailable, throttled after retries, timed out or network failure. A write may or may not have happened. */
  UNAVAILABLE: 5,
  /** The resource does not exist. */
  NOT_FOUND: 6,
} as const;

export type ExitCode = (typeof Exit)[keyof typeof Exit];

export interface ErrorDetail {
  param?: string;
  key?: string;
  message?: string;
}

export class JorttError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCode = Exit.ERROR,
    readonly extra: {
      status?: number;
      key?: string;
      details?: ErrorDetail[];
      hint?: string;
    } = {},
  ) {
    super(message);
    this.name = "JorttError";
  }

  toJSON() {
    return {
      message: this.message,
      ...(this.extra.status !== undefined ? { status: this.extra.status } : {}),
      ...(this.extra.key ? { key: this.extra.key } : {}),
      ...(this.extra.details?.length ? { details: this.extra.details } : {}),
      ...(this.extra.hint ? { hint: this.extra.hint } : {}),
      exitCode: this.exitCode,
    };
  }
}

/** Maps a Jortt API error response to a JorttError with the right exit code. */
export function fromApiError(status: number, body: unknown): JorttError {
  const err = (body as { error?: { key?: string; message?: string; details?: ErrorDetail[] } } | null)?.error;
  const key = err?.key ?? "";
  const message = err?.message ?? `Jortt returned HTTP ${status}`;
  const extra = { status, key: key || undefined, details: err?.details };

  if (status === 401 || key.startsWith("access_token.") || key.startsWith("client.")) {
    let hint = "Check JORTT_CLIENT_ID / JORTT_CLIENT_SECRET, then run `jortt auth refresh`.";
    if (key === "organization.header_required")
      hint = "Set JORTT_ORGANIZATION_ID to one of the ids from `jortt organizations list`.";
    if (key === "organization.requires_mkb_plan") hint = "The Jortt administration needs an MKB or Plus plan for API access.";
    return new JorttError(message, Exit.AUTH, { ...extra, hint });
  }
  if (status === 403 || key === "scopes.insufficient" || key === "permissions.insufficient") {
    return new JorttError(message, Exit.FORBIDDEN, {
      ...extra,
      hint:
        key === "scopes.insufficient"
          ? "Add the missing scope to JORTT_SCOPES (and to the app registration in Jortt), then run `jortt auth refresh`."
          : undefined,
    });
  }
  if (status === 404) return new JorttError(message, Exit.NOT_FOUND, extra);
  if (status === 429 || status >= 500) return new JorttError(message, Exit.UNAVAILABLE, extra);
  return new JorttError(message, Exit.ERROR, extra);
}
