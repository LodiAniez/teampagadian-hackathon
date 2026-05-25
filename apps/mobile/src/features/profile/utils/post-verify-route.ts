type MeResult =
  | { status: 200; body: { name: string | null } }
  | { status: number; body: unknown }
  | null;

export type PostVerifyRoute = "/setup-profile" | "/";

export function pickPostVerifyRoute(me: MeResult): PostVerifyRoute {
  if (me && me.status === 200 && (me.body as { name: string | null }).name === null) {
    return "/setup-profile";
  }
  return "/";
}
