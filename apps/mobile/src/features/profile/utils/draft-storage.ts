import * as SecureStore from "expo-secure-store";
import { UpdateProfileBodySchema, type UpdateProfileDto } from "@raket/contracts";

const DRAFT_KEY = "raket.profile-setup.draft.v1";

export async function saveDraft(draft: UpdateProfileDto): Promise<void> {
  await SecureStore.setItemAsync(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<UpdateProfileDto | null> {
  const raw = await SecureStore.getItemAsync(DRAFT_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = UpdateProfileBodySchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export async function clearDraft(): Promise<void> {
  await SecureStore.deleteItemAsync(DRAFT_KEY);
}
