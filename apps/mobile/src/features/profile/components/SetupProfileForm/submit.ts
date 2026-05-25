import type { UpdateProfileDto } from "@raket/contracts";
import {
  applyBusinessNameAutoFill,
  toUpdateProfileBody,
  type SetupProfileFormValues,
} from "../../utils/form-values";

type SubmitArgs = {
  values: SetupProfileFormValues;
  save: (body: UpdateProfileDto) => Promise<unknown>;
  navigate: () => void;
};

export async function submitSetupProfile({
  values,
  save,
  navigate,
}: SubmitArgs): Promise<{ ok: boolean }> {
  const filled = applyBusinessNameAutoFill(values);
  const body = toUpdateProfileBody(filled);
  try {
    await save(body);
  } catch {
    return { ok: false };
  }
  navigate();
  return { ok: true };
}
