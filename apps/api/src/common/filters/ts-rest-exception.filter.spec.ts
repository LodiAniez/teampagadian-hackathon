import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { toMapped } from "./ts-rest-exception.filter";

const REQUEST_ID = "00000000-0000-0000-0000-000000000000";

describe("TsRestExceptionFilter / toMapped", () => {
  describe("UnprocessableEntityException (TEA-84)", () => {
    it("maps to VALIDATION_FAILED with status 422", () => {
      const mapped = toMapped(new UnprocessableEntityException("BIR regime not set"), REQUEST_ID);
      expect(mapped.status).toBe(422);
      expect(mapped.body.code).toBe("VALIDATION_FAILED");
      expect(mapped.body.message).toBe("BIR regime not set");
      expect(mapped.body.requestId).toBe(REQUEST_ID);
    });

    it("does NOT fall through to the INTERNAL catch-all", () => {
      const mapped = toMapped(new UnprocessableEntityException("anything"), REQUEST_ID);
      expect(mapped.body.code).not.toBe("INTERNAL");
    });
  });

  describe("smoke — existing branches still work", () => {
    it("ZodError → VALIDATION_FAILED 422 with details.issues", () => {
      const zerr = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["x"],
          message: "bad",
        },
      ]);
      const mapped = toMapped(zerr, REQUEST_ID);
      expect(mapped.status).toBe(422);
      expect(mapped.body.code).toBe("VALIDATION_FAILED");
      expect(mapped.body.details).toBeDefined();
    });

    it("NotFoundException → NOT_FOUND 404", () => {
      const mapped = toMapped(new NotFoundException("nope"), REQUEST_ID);
      expect(mapped.status).toBe(404);
      expect(mapped.body.code).toBe("NOT_FOUND");
    });

    it("falls through to INTERNAL 500 for an unrecognized Error", () => {
      const mapped = toMapped(new Error("kaboom"), REQUEST_ID);
      expect(mapped.status).toBe(500);
      expect(mapped.body.code).toBe("INTERNAL");
    });
  });
});
