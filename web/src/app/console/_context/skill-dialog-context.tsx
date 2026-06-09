"use client";

// Tracks which skill's detail dialog is currently open, so the global install
// alert at top-right can hide for that skill (the dialog already surfaces the
// install state inline) but stay visible for other in-flight installs.

import { createContext, useContext, useState, type ReactNode } from "react";

type SkillDialogContextValue = {
  openSkillId: string | null;
  setOpenSkillId: (id: string | null) => void;
};

const SkillDialogContext = createContext<SkillDialogContextValue>({
  openSkillId: null,
  setOpenSkillId: () => {},
});

export function SkillDialogProvider({ children }: { children: ReactNode }) {
  const [openSkillId, setOpenSkillId] = useState<string | null>(null);
  return (
    <SkillDialogContext.Provider value={{ openSkillId, setOpenSkillId }}>
      {children}
    </SkillDialogContext.Provider>
  );
}

export function useSkillDialog() {
  return useContext(SkillDialogContext);
}
