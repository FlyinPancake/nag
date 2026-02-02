import { createContext, useContext, useState, type ReactNode } from "react";
import type { Chore } from "@/lib/api";

interface ChoreFormContextValue {
  isOpen: boolean;
  chore: Chore | null;
  openCreate: () => void;
  openEdit: (chore: Chore) => void;
  close: () => void;
}

const ChoreFormContext = createContext<ChoreFormContextValue | null>(null);

export function ChoreFormProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chore, setChore] = useState<Chore | null>(null);

  const openCreate = () => {
    setChore(null);
    setIsOpen(true);
  };

  const openEdit = (choreToEdit: Chore) => {
    setChore(choreToEdit);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    // Delay clearing chore to allow animation
    setTimeout(() => setChore(null), 200);
  };

  return (
    <ChoreFormContext.Provider
      value={{ isOpen, chore, openCreate, openEdit, close }}
    >
      {children}
    </ChoreFormContext.Provider>
  );
}

export function useChoreForm() {
  const context = useContext(ChoreFormContext);
  if (!context) {
    throw new Error("useChoreForm must be used within ChoreFormProvider");
  }
  return context;
}
