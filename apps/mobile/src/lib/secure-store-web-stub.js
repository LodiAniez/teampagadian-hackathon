// Web stub for expo-secure-store.
// SecureStore is native-only (Keychain/Keystore). On web we fall back to
// localStorage — acceptable for development; production web is not a target.
module.exports = {
  getItemAsync: async (key) => localStorage.getItem(key),
  setItemAsync: async (key, value) => {
    localStorage.setItem(key, value);
  },
  deleteItemAsync: async (key) => {
    localStorage.removeItem(key);
  },
};
