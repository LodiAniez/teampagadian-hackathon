import { useCallback, useState } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { useSetupIntent } from "./use-setup-intent";

export type TokenizedCard = {
  stripePaymentMethodId: string;
};

type FlowError = { message: string };

// Wraps Stripe RN's PaymentSheet around our SetupIntent endpoint so screens
// never touch the native SDK directly (per docs/mobile-convention.md §11).
//
// Flow: fetch SetupIntent from API → initPaymentSheet → presentPaymentSheet →
// retrieveSetupIntent (to pull the paymentMethodId Stripe attached server-side).
// Returns the pm_… id for the next step in the form, or null when the user
// cancels (cancel is not an error, just a no-op).
export function usePaymentSheetFlow() {
  const { initPaymentSheet, presentPaymentSheet, retrieveSetupIntent } = useStripe();
  const setupIntent = useSetupIntent();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<FlowError | null>(null);

  const tokenizeCard = useCallback(async (): Promise<TokenizedCard | null> => {
    setIsRunning(true);
    setError(null);
    try {
      const { clientSecret } = await setupIntent.fetchSetupIntent();

      const init = await initPaymentSheet({
        setupIntentClientSecret: clientSecret,
        merchantDisplayName: "Raket",
      });
      if (init.error) {
        setError({ message: init.error.message });
        return null;
      }

      const present = await presentPaymentSheet();
      if (present.error) {
        // Stripe RN signals user cancel via error.code === "Canceled".
        // Surface other errors; swallow cancel as a no-op.
        if (present.error.code === "Canceled") {
          return null;
        }
        setError({ message: present.error.message });
        return null;
      }

      const retrieved = await retrieveSetupIntent(clientSecret);
      if (retrieved.error || !retrieved.setupIntent?.paymentMethodId) {
        setError({
          message:
            retrieved.error?.message ?? "Card was confirmed but no payment method was returned",
        });
        return null;
      }

      return { stripePaymentMethodId: retrieved.setupIntent.paymentMethodId };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to tokenize card";
      setError({ message });
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [initPaymentSheet, presentPaymentSheet, retrieveSetupIntent, setupIntent]);

  return {
    tokenizeCard,
    isRunning,
    error,
  };
}
