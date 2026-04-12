"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMachinesContext } from "./_context/machines-context";

export default function ConsolePage() {
  const { machines, loading } = useMachinesContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (machines.length === 0) {
      router.replace("/console/onboarding");
    } else {
      router.replace("/console/chat");
    }
  }, [machines, loading, router]);

  return null;
}
