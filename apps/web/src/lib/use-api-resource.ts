'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

/** A small resource hook for the MVP: abort stale requests and preserve errors. */
export function useApiResource<T>(path: string, debounceMs = 0) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const key = `${path}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<T>(path, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setState({ key, data, error: null });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setState({ key, data: null, error: error instanceof Error ? error.message : 'Falha ao carregar os dados' });
          }
        });
    }, debounceMs);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, key, debounceMs]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const update = useCallback((transform: (current: T) => T) => {
    setState((current) => current?.key === key && current.data !== null
      ? { ...current, data: transform(current.data) } : current);
  }, [key]);

  return {
    data: state?.key === key ? state.data : null,
    error: state?.key === key ? state.error : null,
    loading: state?.key !== key,
    reload,
    update,
  };
}
