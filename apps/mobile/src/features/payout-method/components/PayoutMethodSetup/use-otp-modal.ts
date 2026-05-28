import { useState } from "react";

const DEMO_OTP = "123456";

export function useOtpModal(onSuccess: () => void) {
  const [isVisible, setIsVisible] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setCode("");
    setError(null);
    setIsVisible(true);
  };

  const close = () => {
    setCode("");
    setError(null);
    setIsVisible(false);
  };

  const onChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
  };

  const onSubmit = () => {
    if (code !== DEMO_OTP) {
      setError("Incorrect code. Please try again.");
      return;
    }
    close();
    onSuccess();
  };

  return { isVisible, code, error, open, close, onChange, onSubmit };
}
