import { z } from "zod";

type MeResult = { status: 200; body: unknown } | { status: number; body: unknown } | null;

export type PostVerifyRoute = "/setup-profile" | "/";

// Minimal Zod schema for the bit of the /auth/me 200 body we care about.
// passthrough() lets other fields ride along; we only need `name` to make
// the routing decision. If the API contract drifts (rename, type change),
// safeParse fails → we treat that as an unknown state and default to setup.
const MeBodySchema = z.object({ name: z.string().nullable() }).passthrough();

// Routing policy: only a confirmed existing user (200 + parseable body +
// name set) gets the dashboard. Everything else — null, thrown-and-caught,
// non-200, parse failure, name=null — sends the user to /setup-profile.
// /setup-profile is the safe default: a profile-less user landing on / would
// silently break downstream features (invoice creation, sender details);
// a profiled user briefly landing on /setup-profile sees their data
// pre-filled and can navigate away.
export function pickPostVerifyRoute(me: MeResult): PostVerifyRoute {
  if (!me || me.status !== 200) return "/setup-profile";
  const parsed = MeBodySchema.safeParse(me.body);
  if (!parsed.success) return "/setup-profile";
  return parsed.data.name === null ? "/setup-profile" : "/";
}
