import { describe, expect, it } from "vitest";
import {
  SetupProfileFormSchema,
  applyBusinessNameAutoFill,
  buildSetupProfileDefaults,
  toUpdateProfileBody,
} from "./form-values";

describe("buildSetupProfileDefaults", () => {
  it("returns sensible defaults when there is no saved draft", () => {
    expect(buildSetupProfileDefaults(null)).toEqual({
      name: "",
      businessName: "",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
  });

  it("merges a saved draft over the defaults", () => {
    const merged = buildSetupProfileDefaults({
      name: "Ada Lovelace",
      bir2303Election: "graduated",
    });
    expect(merged.name).toBe("Ada Lovelace");
    expect(merged.bir2303Election).toBe("graduated");
    expect(merged.defaultCurrency).toBe("USD");
  });

  it("keeps the draft's hourly rate when present", () => {
    const merged = buildSetupProfileDefaults({
      defaultHourlyRate: { amount: 75, currency: "EUR" },
    });
    expect(merged.defaultHourlyRate).toEqual({ amount: 75, currency: "EUR" });
  });

  it("syncs hourly-rate currency to defaultCurrency when only defaultCurrency is in the draft", () => {
    const merged = buildSetupProfileDefaults({ defaultCurrency: "PHP" });
    expect(merged.defaultCurrency).toBe("PHP");
    expect(merged.defaultHourlyRate.currency).toBe("PHP");
  });
});

describe("applyBusinessNameAutoFill", () => {
  it("fills businessName as '<name> Freelance' when businessName is blank and name is set", () => {
    const next = applyBusinessNameAutoFill({
      name: "Ada Lovelace",
      businessName: "",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(next.businessName).toBe("Ada Lovelace Freelance");
  });

  it("treats whitespace-only businessName as blank", () => {
    const next = applyBusinessNameAutoFill({
      name: "Ada",
      businessName: "   ",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(next.businessName).toBe("Ada Freelance");
  });

  it("preserves a user-set businessName", () => {
    const next = applyBusinessNameAutoFill({
      name: "Ada",
      businessName: "Northwind Studio",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(next.businessName).toBe("Northwind Studio");
  });

  it("leaves businessName blank when name is also blank", () => {
    const next = applyBusinessNameAutoFill({
      name: "  ",
      businessName: "",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(next.businessName).toBe("");
  });
});

describe("toUpdateProfileBody", () => {
  it("omits blank optional fields and zero/undefined hourly rate", () => {
    const body = toUpdateProfileBody({
      name: "Ada",
      businessName: "",
      defaultCurrency: "",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(body).toEqual({ name: "Ada", bir2303Election: "8_percent" });
  });

  it("includes all fields when they are populated", () => {
    const body = toUpdateProfileBody({
      name: "Ada Lovelace",
      businessName: "Northwind",
      defaultCurrency: "EUR",
      defaultHourlyRate: { amount: 95, currency: "EUR" },
      bir2303Election: "graduated",
    });
    expect(body).toEqual({
      name: "Ada Lovelace",
      businessName: "Northwind",
      defaultCurrency: "EUR",
      defaultHourlyRate: { amount: 95, currency: "EUR" },
      bir2303Election: "graduated",
    });
  });

  it("trims whitespace around name and businessName", () => {
    const body = toUpdateProfileBody({
      name: "  Ada  ",
      businessName: "  Northwind  ",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: undefined, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(body.name).toBe("Ada");
    expect(body.businessName).toBe("Northwind");
  });

  it("tolerates the partial shape form.watch emits (no crash on undefined fields)", () => {
    // form.watch emits SetupProfileFormValuesPartial during the brief
    // mount/reset window. Defensive ?? "" inside the function means
    // autosave can't crash + swallow the error via `void`.
    const body = toUpdateProfileBody({ bir2303Election: "8_percent" });
    expect(body).toEqual({ bir2303Election: "8_percent" });
  });

  it("falls back to defaultCurrency for an unspecified rate currency", () => {
    const body = toUpdateProfileBody({
      name: "Ada",
      defaultCurrency: "EUR",
      defaultHourlyRate: { amount: 90 },
      bir2303Election: "8_percent",
    });
    expect(body.defaultHourlyRate).toEqual({ amount: 90, currency: "EUR" });
  });
});

describe("SetupProfileFormSchema", () => {
  const VALID = {
    name: "Ada",
    businessName: "Ada Freelance",
    defaultCurrency: "USD",
    defaultHourlyRate: { amount: 80, currency: "USD" },
    bir2303Election: "8_percent" as const,
  };

  it("accepts a fully-populated form", () => {
    expect(SetupProfileFormSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an empty name with a 'required' message", () => {
    const result = SetupProfileFormSchema.safeParse({ ...VALID, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === "name");
      expect(nameIssue?.message.toLowerCase()).toContain("required");
    }
  });

  it("accepts name only — every other field is optional at the form layer", () => {
    expect(
      SetupProfileFormSchema.safeParse({
        name: "Ada",
        businessName: "",
        defaultCurrency: "USD",
        defaultHourlyRate: { amount: undefined, currency: "USD" },
        bir2303Election: "8_percent",
      }).success,
    ).toBe(true);
  });
});
