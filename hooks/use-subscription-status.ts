"use client";

import { useEffect, useState } from "react";

type SubscriptionStatus = "unknown" | "active" | "inactive" | "error";

type SubscriptionStatusResponse = {
  active: boolean;
};

export function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus>("unknown");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function fetchStatus() {
      try {
        const response = await fetch("/api/subscription/status");

        if (!response.ok) {
          if (!isCancelled) {
            setStatus("error");
          }
          return;
        }

        const data = (await response.json()) as SubscriptionStatusResponse;

        if (!isCancelled) {
          setStatus(data.active ? "active" : "inactive");
        }
      } catch {
        if (!isCancelled) {
          setStatus("error");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    status,
    isLoading,
    isActive: status === "active",
  };
}
