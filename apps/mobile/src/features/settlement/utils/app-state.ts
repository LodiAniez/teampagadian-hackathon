import type { AppStateStatus } from "react-native";

/**
 * Whether the realtime subscription should be live for a given AppState.
 * We only hold the channel open in the foreground ("active") and drop it when
 * the OS backgrounds or deactivates the app, so we don't leak a socket.
 */
export function shouldSubscribe(status: AppStateStatus): boolean {
  return status === "active";
}
