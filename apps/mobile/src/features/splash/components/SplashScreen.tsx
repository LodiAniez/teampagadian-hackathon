import { Image, View } from "react-native";

// Mirrors the native splash asset so the transition is seamless
const splashImage = require("../../../assets/splash.png");

export function AppSplashScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-700">
      <Image source={splashImage} className="w-full h-full" resizeMode="contain" />
    </View>
  );
}
