export const NETWORK_TIMEOUT_MS = 15000;

export function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = NETWORK_TIMEOUT_MS): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}
