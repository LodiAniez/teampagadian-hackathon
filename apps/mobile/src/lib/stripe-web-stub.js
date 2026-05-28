// Web stub for @stripe/stripe-react-native.
// The real package uses native Codegen modules that don't exist on web.
// This file is swapped in by metro.config.js when platform === 'web'.
const React = require("react");

function StripeProvider({ children }) {
  return children ?? null;
}

function useStripe() {
  return {};
}

function usePaymentSheet() {
  return {
    initPaymentSheet: async () => ({
      error: { code: "Unsupported", message: "Web not supported" },
    }),
    presentPaymentSheet: async () => ({
      error: { code: "Unsupported", message: "Web not supported" },
    }),
    loading: false,
  };
}

module.exports = { StripeProvider, useStripe, usePaymentSheet };
