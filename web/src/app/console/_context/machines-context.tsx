"use client";

import { createContext, useContext } from "react";
import { useMachines, type Machine } from "@/hooks/use-machines";

type MachinesContextValue = ReturnType<typeof useMachines>;

const MachinesContext = createContext<MachinesContextValue | null>(null);

export function MachinesProvider({ children }: { children: React.ReactNode }) {
  const value = useMachines();
  return (
    <MachinesContext.Provider value={value}>{children}</MachinesContext.Provider>
  );
}

export function useMachinesContext(): MachinesContextValue {
  const ctx = useContext(MachinesContext);
  if (!ctx) throw new Error("useMachinesContext must be used within MachinesProvider");
  return ctx;
}

export type { Machine };
