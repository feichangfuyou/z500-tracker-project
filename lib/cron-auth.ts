import { secretEquals } from "@/lib/http";

export function cronKey() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  if (process.env.VERCEL) return "";
  return "dev-cron";
}

export function cronAuthorized(req: Request) {
  const key = cronKey();
  if (!key) return false;
  const header = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return secretEquals(header.slice(prefix.length), key);
}
