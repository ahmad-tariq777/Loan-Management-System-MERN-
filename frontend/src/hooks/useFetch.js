import { useState, useEffect, useCallback, useRef } from "react";
import { errorMessage } from "../utils/format";

export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;

  const execute = useCallback(async () => {
    setLoading(true);
    setError("");
    setStatus(null);
    try {
      const res = await fnRef.current();
      setData(res.data);
    } catch (err) {
      setData(null);
      setStatus(err.response?.status || null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, status, refetch: execute };
}
