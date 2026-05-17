import type { Request } from "express";

export type AuthUser = {
  id: string;
  phone: string | null;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};
