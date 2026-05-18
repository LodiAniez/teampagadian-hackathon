import type { Request } from "express";

export type AuthUser = {
  id: string;
  phone: string;
};

export type AuthedRequest = Request & {
  user?: AuthUser;
};
