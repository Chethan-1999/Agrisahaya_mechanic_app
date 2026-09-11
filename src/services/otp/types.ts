/** A pending phone verification — resolves once the entered code is accepted, signing the technician in. */
export interface OtpSession {
  confirm(code: string): Promise<void>;
}

export interface OtpRequestResult {
  session: OtpSession;
  /** Only set by the local/dev provider — there's no real SMS to check against in local dev. */
  devHint?: string;
}

/** One method, one job: start phone verification for an E.164 number. Everything after is on the returned session. */
export interface OtpProvider {
  requestOtp(phoneE164: string): Promise<OtpRequestResult>;
}
