import { z } from "zod";

const serverEnvSchema = z
  .object({
    GOOGLE_SPREADSHEET_ID: z.string().trim().min(1),
    GOOGLE_DRIVE_IMAGE_FOLDER_ID: z.string().trim().min(1),
    GOOGLE_CLIENT_EMAIL: z.string().trim().email(),
    GOOGLE_PRIVATE_KEY: z.string().trim().min(1),
    ADMIN_PIN_HASH: z.string().trim().min(1),
    SESSION_SECRET: z.string().min(32),
    APP_TIMEZONE: z.string().trim().min(1),
    NEXT_PUBLIC_APP_VERSION: z.string().trim().min(1),
  })
  .superRefine((env, ctx) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: env.APP_TIMEZONE }).format();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_TIMEZONE"],
        message: "APP_TIMEZONE must be a valid IANA time zone",
      });
    }
  });

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_VERSION: z.string().trim().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Convert the escaped newline representation used by most hosting secret stores. */
export function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n").trim();
}

function formatEnvError(error: z.ZodError): Error {
  const fields = error.issues.map((issue) => issue.path.join(".") || "environment");
  return new Error(`Invalid server environment. Check: ${[...new Set(fields)].join(", ")}`);
}

export function parseServerEnv(input: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw formatEnvError(parsed.error);
  }

  return {
    ...parsed.data,
    GOOGLE_PRIVATE_KEY: normalizePrivateKey(parsed.data.GOOGLE_PRIVATE_KEY),
  };
}

export function parsePublicEnv(input: Record<string, string | undefined> = process.env): PublicEnv {
  const parsed = publicEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw formatEnvError(parsed.error);
  }
  return parsed.data;
}

let cachedServerEnv: ServerEnv | undefined;

/** Lazy access prevents client modules from evaluating server-only secrets. */
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv();
  return cachedServerEnv;
}

export function resetServerEnvCache(): void {
  cachedServerEnv = undefined;
}
