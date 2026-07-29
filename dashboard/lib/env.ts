/**
 * Environment variable access with actionable failure messages.
 *
 * Every entry point that needs a connection string goes through here so a
 * missing or blank value fails the same way, naming the file to edit rather
 * than surfacing a driver-level connection error.
 */

const SETUP_HINT =
  "Copy dashboard/.env.example to dashboard/.env.local and fill in the value.";

const HINTS: Record<string, string> = {
  DATABASE_URL:
    "Neon → Connect → Prisma gives you two strings. Use the POOLED one " +
    "(host contains `-pooler`) here.",
  DIRECT_URL:
    "Use Neon's DIRECT connection string — the same host with `-pooler` " +
    "removed. Prisma Migrate needs it.",
  GROQ_API_KEY: "Create a key at https://console.groq.com/keys.",
};

/**
 * Returns the value of `name`, or throws explaining how to set it.
 * A variable set to an empty or whitespace-only string counts as missing,
 * which is what you get from copying `.env.example` without editing it.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    const reason =
      process.env[name] === undefined
        ? `${name} is not set.`
        : `${name} is set but empty.`;

    throw new Error(
      [reason, "", SETUP_HINT, HINTS[name]].filter(Boolean).join("\n"),
    );
  }

  return value;
}

/**
 * The connection string the Prisma CLI should use for migrations.
 *
 * Neon's pooler runs PgBouncer in transaction mode, which does not hold the
 * session state Prisma Migrate relies on, so migrations use `DIRECT_URL`.
 * Falls back to `DATABASE_URL` for non-Neon setups (a local Postgres has no
 * separate pooled endpoint), warning if that fallback looks pooled.
 */
export function migrationUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();

  if (direct) {
    if (direct.includes("-pooler")) {
      console.warn(
        "⚠  DIRECT_URL points at a pooled endpoint (host contains `-pooler`).\n" +
          "   Migrations may fail or hang. Remove `-pooler` from the host.",
      );
    }
    return direct;
  }

  const fallback = requireEnv("DATABASE_URL");

  if (fallback.includes("-pooler")) {
    console.warn(
      "⚠  DIRECT_URL is not set and DATABASE_URL is a pooled endpoint.\n" +
        "   Set DIRECT_URL to the same host without `-pooler` before migrating.",
    );
  }

  return fallback;
}
