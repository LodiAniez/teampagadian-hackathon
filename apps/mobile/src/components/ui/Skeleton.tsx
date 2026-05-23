import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...rest }: ViewProps) {
  return <View className={cn("rounded-lg bg-gray-100 animate-pulse", className)} {...rest} />;
}
