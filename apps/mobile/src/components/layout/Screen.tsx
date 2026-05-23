import { KeyboardAvoidingView, Platform, ScrollView, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";

type Props = ViewProps & {
  scroll?: boolean;
};

export function Screen({ className, scroll = false, children, ...rest }: Props) {
  const content = scroll ? (
    <SafeAreaView className="flex-1 bg-gray-50" {...rest}>
      <ScrollView
        className="flex-1"
        contentContainerClassName={cn("p-4", className)}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  ) : (
    <SafeAreaView className={cn("flex-1 bg-gray-50 p-4", className)} {...rest}>
      {children}
    </SafeAreaView>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {content}
    </KeyboardAvoidingView>
  );
}
