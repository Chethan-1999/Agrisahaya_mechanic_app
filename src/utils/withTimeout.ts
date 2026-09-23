export const NETWORK_TIMEOUT_MS = 15000;

export function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), NETWORK_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}
