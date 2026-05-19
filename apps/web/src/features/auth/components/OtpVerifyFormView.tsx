import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Props = {
  phone: string;
  code: string;
  setCode: (next: string) => void;
  isSubmitting: boolean;
  error: string | null;
  resendIsReady: boolean;
  resendRemaining: number;
  onResend: () => void;
};

export function OtpVerifyFormView({
  phone,
  code,
  setCode,
  isSubmitting,
  error,
  resendIsReady,
  resendRemaining,
  onResend,
}: Props) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Enter your code</CardTitle>
        <CardDescription>
          We sent a 6-digit code to <span className="font-medium text-slate-900">{phone}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isSubmitting}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && (
            <p role="alert" className="text-center text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              disabled={!resendIsReady || isSubmitting}
            >
              {resendIsReady ? "Resend code" : `Resend in ${resendRemaining}s`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
