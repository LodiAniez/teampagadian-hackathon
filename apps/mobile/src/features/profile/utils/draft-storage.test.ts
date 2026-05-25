import { beforeEach, describe, expect, it, vi } from "vitest";

const { secureStoreState } = vi.hoisted(() => ({
  secureStoreState: { store: new Map<string, string>() },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreState.store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreState.store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreState.store.delete(key);
  }),
}));

beforeEach(() => {
  secureStoreState.store.clear();
});

describe("draft-storage", () => {
  it("save → load roundtrips a partial profile draft", async () => {
    const { saveDraft, loadDraft } = await import("./draft-storage");
    await saveDraft({ name: "Ada Lovelace", defaultCurrency: "USD" });
    await expect(loadDraft()).resolves.toEqual({
      name: "Ada Lovelace",
      defaultCurrency: "USD",
    });
  });

  it("load returns null when no draft has been saved", async () => {
    const { loadDraft } = await import("./draft-storage");
    await expect(loadDraft()).resolves.toBeNull();
  });

  it("clearDraft removes the saved draft", async () => {
    const { saveDraft, clearDraft, loadDraft } = await import("./draft-storage");
    await saveDraft({ name: "Ada" });
    await clearDraft();
    await expect(loadDraft()).resolves.toBeNull();
  });

  it("load returns null when stored value is not valid JSON", async () => {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync("raket.profile-setup.draft.v1", "{not-json");
    const { loadDraft } = await import("./draft-storage");
    await expect(loadDraft()).resolves.toBeNull();
  });

  it("load returns null when stored value fails schema validation", async () => {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(
      "raket.profile-setup.draft.v1",
      JSON.stringify({ defaultHourlyRate: "not-an-object" }),
    );
    const { loadDraft } = await import("./draft-storage");
    await expect(loadDraft()).resolves.toBeNull();
  });

  it("save persists nested defaultHourlyRate shape", async () => {
    const { saveDraft, loadDraft } = await import("./draft-storage");
    await saveDraft({
      name: "Ada",
      defaultHourlyRate: { amount: 75, currency: "USD" },
      bir2303Election: "8_percent",
    });
    await expect(loadDraft()).resolves.toEqual({
      name: "Ada",
      defaultHourlyRate: { amount: 75, currency: "USD" },
      bir2303Election: "8_percent",
    });
  });
});
