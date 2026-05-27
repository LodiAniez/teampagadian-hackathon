import { describe, expect, it, vi } from "vitest";
import { submitSetupProfile } from "./submit";
import type { SetupProfileFormValues } from "../../utils/form-values";
import type { UpdateProfileDto } from "@raket/contracts";

type SaveFn = (body: UpdateProfileDto) => Promise<unknown>;

const VALUES: SetupProfileFormValues = {
  name: "Ada Lovelace",
  businessName: "Ada Lovelace Freelance",
  defaultCurrency: "USD",
  defaultHourlyRate: { amount: 80, currency: "USD" },
  bir2303Election: "8_percent",
};

describe("submitSetupProfile", () => {
  it("calls save with the trimmed body and navigates on success", async () => {
    const save: SaveFn = vi.fn(async () => undefined);
    const navigate = vi.fn();
    const result = await submitSetupProfile({ values: VALUES, save, navigate });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      businessName: "Ada Lovelace Freelance",
      defaultCurrency: "USD",
      defaultHourlyRate: { amount: 80, currency: "USD" },
      bir2303Election: "8_percent",
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("does not navigate when save rejects", async () => {
    const save = vi.fn(async () => {
      throw new Error("422");
    });
    const navigate = vi.fn();
    const result = await submitSetupProfile({ values: VALUES, save, navigate });
    expect(navigate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false });
  });

  it("applies businessName auto-fill before submitting", async () => {
    const save: SaveFn = vi.fn(async () => undefined);
    const navigate = vi.fn();
    await submitSetupProfile({
      values: { ...VALUES, businessName: "" },
      save,
      navigate,
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: "Ada Lovelace Freelance" }),
    );
  });
});
