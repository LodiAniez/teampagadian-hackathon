import { useState } from "react";
import { useStripe, usePaymentSheet } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";
import { useSetupIntent } from "../../hooks/use-setup-intent";
import { useAddPayoutMethod } from "../../hooks/use-add-payout-method";
import { useOtpModal } from "./use-otp-modal";

type Stage = "idle" | "tokenizing" | "saving" | "card-ready" | "error";

export type CardSummary = { brand: string; last4: string };

export function usePayoutMethodSetup() {
  const [stage, setStage] = useState<Stage>("idle");
  const [cardSummary, setCardSummary] = useState<CardSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setupIntent = useSetupIntent();
  const addPayoutMethod = useAddPayoutMethod();
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { retrieveSetupIntent } = useStripe();
  const router = useRouter();

  const otpModal = useOtpModal(() => {
    router.replace("/(authed)/(tabs)");
  });

  const onAddCard = async () => {
    setStage("tokenizing");
    setErrorMessage(null);

    try {
      const { status: siStatus, body: siBody } = await setupIntent.fetch();
      if (siStatus !== 201) throw new Error("Could not create setup intent");
      const clientSecret = siBody.clientSecret;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Raket",
        setupIntentClientSecret: clientSecret,
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        // User cancelled — return to idle without an error message
        if (presentError.code === "Canceled") {
          setStage("idle");
          return;
        }
        throw new Error(presentError.message);
      }

      setStage("saving");

      const { setupIntent: si, error: retrieveError } = await retrieveSetupIntent(clientSecret);
      if (retrieveError || !si?.paymentMethodId) {
        throw new Error(retrieveError?.message ?? "Could not retrieve payment method");
      }

      const result = await addPayoutMethod.save({
        type: "card",
        stripePaymentMethodId: si.paymentMethodId,
      });

      if (result.status === 201 && result.body.type === "card") {
        setCardSummary({
          brand: result.body.details.brand,
          last4: result.body.details.last4,
        });
      }

      setStage("card-ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  };

  return {
    stage,
    cardSummary,
    errorMessage,
    onAddCard,
    isTokenizing: stage === "tokenizing" || stage === "saving",
    onConfirm: otpModal.open,
    otpModal,
  };
}
