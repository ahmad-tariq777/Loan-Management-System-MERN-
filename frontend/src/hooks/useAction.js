import { useState, useCallback } from "react";
import { errorMessage } from "../utils/format";

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const run = useCallback(async (fn, successText) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fn();
      setSuccess(successText || res?.data?.message || "Done");
      return res;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  return { busy, error, success, run, reset };
}
