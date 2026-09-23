import { useState } from 'react';

import { getErrorMessage, type Toast } from '../components/ui';

export function useLoadingState() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  async function withLoading(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (error) {
      setToast({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return { loading, toast, setToast, withLoading };
}
