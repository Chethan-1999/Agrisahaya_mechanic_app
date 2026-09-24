import { useState } from 'react';

import { getErrorMessage, type Toast } from '../components/ui';

/** `describeError` turns a failure into the toast text — the mechanic app passes a translating one. */
export function useLoadingState(describeError: (error: unknown) => string = getErrorMessage) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  async function withLoading(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (error) {
      setToast({ kind: 'error', text: describeError(error) });
    } finally {
      setLoading(false);
    }
  }

  return { loading, toast, setToast, withLoading };
}
