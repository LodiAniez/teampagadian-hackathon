import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { env } from "@/lib/env";
import { notificationError, notificationSuccess } from "@/lib/haptics";
import { useInvoiceById } from "../../hooks/use-invoice-by-id";
import { useSendInvoice } from "../../hooks/use-send-invoice";
import { buildInvoiceShareUrl } from "../../utils/share-url";

export type ToastKind = "success" | "error";
export type Toast = { kind: ToastKind; message: string } | null;

const TOAST_DURATION_MS = 2500;

export function useInvoiceSent(invoiceId: string | undefined) {
  const router = useRouter();
  const invoiceQuery = useInvoiceById(invoiceId);
  const sendMutation = useSendInvoice(invoiceId);

  const [toast, setToast] = useState<Toast>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareUrl = useMemo(
    () => (invoiceId ? buildInvoiceShareUrl(invoiceId, env.EXPO_PUBLIC_APP_URL) : ""),
    [invoiceId],
  );

  const showToast = useCallback((kind: ToastKind, message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, message });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    if (kind === "success") notificationSuccess();
    else notificationError();
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const onCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      showToast("success", "Link copied — paste anywhere");
    } catch {
      showToast("error", "Couldn't copy link. Try again.");
    }
  }, [shareUrl, showToast]);

  const onShowQr = useCallback(() => {
    if (!shareUrl) return;
    setIsQrOpen(true);
  }, [shareUrl]);

  const onCloseQr = useCallback(() => setIsQrOpen(false), []);

  const onSendEmail = useCallback(async () => {
    const clientEmail = invoiceQuery.invoice?.client.email;
    if (!clientEmail) {
      showToast("error", "No client email on file — add one in the invoice first.");
      return;
    }
    const result = await sendMutation.send({ clientEmail });
    if (result) {
      showToast("success", `Sent to ${clientEmail}`);
    } else if (sendMutation.error) {
      showToast("error", sendMutation.error.message);
    }
  }, [invoiceQuery.invoice?.client.email, sendMutation, showToast]);

  const onViewInvoice = useCallback(() => {
    if (!invoiceId) return;
    router.push({ pathname: "/invoices/[id]", params: { id: invoiceId } });
  }, [router, invoiceId]);

  const onDone = useCallback(() => {
    router.dismissAll();
  }, [router]);

  return {
    invoice: invoiceQuery.invoice,
    isLoading: invoiceQuery.isLoading,
    loadError: invoiceQuery.error,
    shareUrl,
    toast,
    isQrOpen,
    isSendingEmail: sendMutation.isSending,
    onCopyLink,
    onShowQr,
    onCloseQr,
    onSendEmail,
    onViewInvoice,
    onDone,
  };
}
