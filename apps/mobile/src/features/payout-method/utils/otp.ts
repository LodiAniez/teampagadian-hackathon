// Demo-only OTP check. The actual freshness gate runs on the backend's
// FreshAuthGuard against the user's Supabase-issued JWT (`amr` claim). This
// constant + checker exists so the mobile flow visibly mirrors what a
// production step-up would look like during the hackathon demo.
//
// TODO(prod): replace the constant compare with a Supabase OTP step-up
// (supabase.auth.signInWithOtp + verifyOtp) so the JWT's amr timestamp gets
// refreshed before POST /payout-methods.
export const DEMO_OTP_CODE = "123456";

export function isValidDemoOtp(code: string): boolean {
  return code === DEMO_OTP_CODE;
}
