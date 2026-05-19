import { redirect } from "next/navigation";
import { PhoneNumberSchema } from "@raket/contracts";
import { OtpVerifyForm } from "@/features/auth";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  const parsed = PhoneNumberSchema.safeParse(phone);
  if (!parsed.success) {
    redirect("/login");
  }

  return <OtpVerifyForm phone={parsed.data} />;
}
