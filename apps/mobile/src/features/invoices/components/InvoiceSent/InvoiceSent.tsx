import { View } from "react-native";
import {
  HeroSkeleton,
  InlineToast,
  LoadErrorState,
  QrModal,
  SecondaryActions,
  ShareActionRow,
  SuccessHero,
} from "./InvoiceSent.parts";
import { useInvoiceSent } from "./use-invoice-sent";

export function InvoiceSent({ invoiceId }: { invoiceId: string | undefined }) {
  const s = useInvoiceSent(invoiceId);

  if (s.loadError) {
    return <LoadErrorState message={s.loadError.message} onBack={s.onDone} />;
  }

  return (
    <View className="flex-1 gap-3">
      {s.isLoading || !s.invoice ? <HeroSkeleton /> : <SuccessHero invoice={s.invoice} />}

      <InlineToast toast={s.toast} />

      <View className="gap-3">
        <ShareActionRow
          icon="▦"
          label="Show QR code"
          caption="Let your client scan it from a phone"
          onPress={s.onShowQr}
          disabled={!s.shareUrl}
        />
        <ShareActionRow
          icon="⎘"
          label="Copy link"
          caption="Paste anywhere — Messenger, SMS, Slack"
          onPress={s.onCopyLink}
          disabled={!s.shareUrl}
        />
        <ShareActionRow
          icon="✉"
          label="Send email"
          caption={
            s.invoice?.client.email
              ? `Email to ${s.invoice.client.email}`
              : "Add a client email first"
          }
          onPress={s.onSendEmail}
          isLoading={s.isSendingEmail}
          disabled={!s.invoice?.client.email}
        />
      </View>

      <SecondaryActions onViewInvoice={s.onViewInvoice} onDone={s.onDone} />

      <QrModal visible={s.isQrOpen} url={s.shareUrl} onClose={s.onCloseQr} />
    </View>
  );
}
