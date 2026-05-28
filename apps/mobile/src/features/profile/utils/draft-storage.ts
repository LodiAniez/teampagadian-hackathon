import AsyncStorage from "@react-native-async-storage/async-storage";
import { UpdateProfileBodySchema, type UpdateProfileDto } from "@raket/contracts";

const DRAFT_KEY = "raket.profile-setup.draft.v1";

export async function saveDraft(draft: UpdateProfileDto): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<UpdateProfileDto | null> {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
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
  await AsyncStorage.removeItem(DRAFT_KEY);
}
