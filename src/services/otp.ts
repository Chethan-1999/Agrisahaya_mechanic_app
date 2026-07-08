export function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function canVerifyOtp(sentOtp: string | null, enteredOtp: string) {
  return Boolean(sentOtp && enteredOtp.trim() === sentOtp);
}