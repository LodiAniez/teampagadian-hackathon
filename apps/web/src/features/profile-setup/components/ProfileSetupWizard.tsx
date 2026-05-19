"use client";

import { useProfileSetup } from "../hooks/use-profile-setup";
import { ProfileSetupWizardView } from "./ProfileSetupWizardView";

export function ProfileSetupWizard() {
  const setup = useProfileSetup();
  return <ProfileSetupWizardView {...setup} />;
}
