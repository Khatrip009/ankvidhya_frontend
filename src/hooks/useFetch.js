// src/hooks/useFetch.js
import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";

/**
 * useFetch - small helper for GET endpoints
 * @param {string} url - endpoint to call (relative or absolute)
 * @param {object} opts - { query, auto (default true) }
 * @returns { data, loading, error, reload }
 */
export default function useFetch(url, opts = {}) {
  const { query, auto = true, expect = "auto" } = opts;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(auto));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!auto) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    api.get(url, { query, expect })
      .then(res => { if (!mounted) return; setData(res); })
      .catch(err => { if (!mounted) return; setError(err); })
      .finally(() => { if (!mounted) return; setLoading(false); });

    return () => { mounted = false; };
  }, [url, JSON.stringify(query || {}), tick, auto, expect]);

  return { data, loading, error, reload };
}
