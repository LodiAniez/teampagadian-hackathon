import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorResponseSchema } from "../shared/error";
import {
  RequestOtpBodySchema,
  RequestOtpResponseSchema,
  SessionSchema,
  UpdateProfileBodySchema,
  UserSchema,
  VerifyOtpBodySchema,
} from "./auth.schema";

const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const authContract = c.router(
  {
    requestOtp: {
      method: "POST",
      path: "/request-otp",
      body: RequestOtpBodySchema,
      responses: {
        200: RequestOtpResponseSchema,
        422: ErrorResponseSchema,
        429: ErrorResponseSchema,
      },
      summary: "Request an OTP code for the given phone number",
    },
    verifyOtp: {
      method: "POST",
      path: "/verify-otp",
      body: VerifyOtpBodySchema,
      responses: {
        200: SessionSchema,
        401: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
      summary: "Verify the OTP and exchange for a session",
    },
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
