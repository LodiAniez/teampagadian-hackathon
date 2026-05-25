import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { Invoice } from "@raket/contracts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Toast } from "./use-invoice-sent";

export function SuccessHero({ invoice }: { invoice: Invoice }) {
  return (
    <View className="items-center gap-3 py-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <Text className="text-3xl text-emerald-600">✓</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900">Invoice created</Text>
      <Text className="text-sm text-gray-500">
        {invoice.number} · {formatMoney(invoice.amount, invoice.currency)}
      </Text>
    </View>
  );
}

export function HeroSkeleton() {
  return (
    <View className="items-center gap-3 py-6">
      <View className="h-16 w-16 rounded-full bg-gray-200" />
      <View className="h-6 w-40 rounded-md bg-gray-200" />
      <View className="h-4 w-32 rounded-md bg-gray-200" />
    </View>
  );
}

export function LoadErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Text className="text-base font-semibold text-gray-800">Couldn't load invoice</Text>
      <Text className="text-center text-sm text-gray-500">{message}</Text>
      <Button variant="secondary" onPress={onBack}>
        Back
      </Button>
    </View>
  );
}

type ShareActionRowProps = {
  icon: string;
  label: string;
  caption: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export function ShareActionRow({
  icon,
  label,
  caption,
  onPress,
  isLoading,
  disabled,
}: ShareActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        "active:scale-[0.99] active:opacity-90",
        (disabled || isLoading) && "opacity-50",
      )}
    >
      <Card className="flex-row items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
          <Text className="text-2xl">{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">{label}</Text>
          <Text className="mt-0.5 text-xs text-gray-500">{caption}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color="#0d9488" />
        ) : (
          <Text className="text-2xl text-gray-300">›</Text>
        )}
      </Card>
    </Pressable>
  );
}

type QrModalProps = {
  visible: boolean;
  url: string;
  onClose: () => void;
};

export function QrModal({ visible, url, onClose }: QrModalProps) {
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent={false}>
      <View className="flex-1 items-center justify-center gap-6 bg-white p-6">
        <Text className="text-xl font-bold text-gray-900">Scan to pay</Text>
        {url ? (
          <View className="rounded-3xl bg-white p-6 shadow-xl shadow-black/10">
            <QRCode value={url} size={260} backgroundColor="#ffffff" color="#0f172a" />
          </View>
        ) : null}
        <Text
          className="px-4 text-center text-xs text-gray-500"
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {url}
        </Text>
        <View className="w-full max-w-xs">
          <Button variant="secondary" fullWidth onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export function InlineToast({ toast }: { toast: Toast }) {
  if (!toast) return null;
  const isSuccess = toast.kind === "success";
  return (
    <View
      accessibilityLiveRegion="polite"
      className={cn(
        "mb-3 flex-row items-center gap-2 rounded-xl px-3 py-2",
        isSuccess ? "border border-emerald-200 bg-emerald-50" : "border border-red-200 bg-red-50",
      )}
    >
      <Text className={isSuccess ? "text-emerald-700" : "text-red-700"}>
        {isSuccess ? "✓" : "⚠"}
      </Text>
      <Text className={cn("flex-1 text-sm", isSuccess ? "text-emerald-900" : "text-red-900")}>
        {toast.message}
      </Text>
    </View>
  );
}

export function SecondaryActions({
  onViewInvoice,
  onDone,
}: {
  onViewInvoice: () => void;
  onDone: () => void;
}) {
  return (
    <View className="mt-4 flex-row gap-3">
      <View className="flex-1">
        <Button variant="secondary" fullWidth onPress={onViewInvoice}>
          View invoice
        </Button>
      </View>
      <View className="flex-1">
        <Button variant="ghost" fullWidth onPress={onDone}>
          Done
        </Button>
      </View>
    </View>
  );
}
