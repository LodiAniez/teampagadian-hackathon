import * as Haptics from "expo-haptics";

export function impactLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function impactMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function notificationSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function notificationError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
