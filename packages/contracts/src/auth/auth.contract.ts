import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import { UpdateProfileBodySchema, UserSchema } from "./auth.schema";

const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const authContract = c.router(
  {
    me: {
      method: "GET",
      path: "/me",
      headers: authedHeaders,
      responses: {
        200: UserSchema,
        401: ErrorResponseSchema,
      },
      summary: "Get the authenticated user",
    },
    updateProfile: {
      method: "PATCH",
      path: "/me",
      headers: authedHeaders,
      body: UpdateProfileBodySchema,
      responses: {
        200: UserSchema,
        401: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Update the authenticated user's profile",
    },
  },
  {
    pathPrefix: "/auth",
    strictStatusCodes: true,
  },
);
