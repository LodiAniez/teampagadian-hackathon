import type { Request } from "express";
import { z } from "zod";

export type AuthUser = {
  id: string;
  phone: string;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};

export const AmrSchema = z.array(z.object({ method: z.string(), timestamp: z.number() }));

export type AmrEntry = z.infer<typeof AmrSchema>[number];

export type VerifiedPayload = {
  sub: string;
  phone: string;
  amr?: AmrEntry[];
};
