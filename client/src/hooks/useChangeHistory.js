import { useState, useEffect, useCallback } from 'react';
import { getChangeHistory } from '../lib/api.js';

export function useChangeHistory(accountId, section) {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const { changes: rows } = await getChangeHistory(accountId, section);
      setChanges(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, section]);

  useEffect(() => {
    load();
  }, [load]);

  return { changes, loading, error, reload: load };
}
