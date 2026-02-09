import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Chore, ChoreWithDue } from "@/lib/api";

type ChoreFormMode = "panel" | "palette" | "detail" | null;

interface ChoreFormContextValue {
  /** Which form/view is currently open, or null if none */
  mode: ChoreFormMode;
  /** The chore being edited or viewed, null for create */
  chore: Chore | null;
  /** The chore with due info being viewed (detail mode) */
  detailChore: ChoreWithDue | Chore | null;
  /** Whether the side panel (form) is open */
  isPanelOpen: boolean;
  /** Whether the quick-add palette is open */
  isPaletteOpen: boolean;
  /** Whether the detail panel is open */
  isDetailOpen: boolean;
  /** Whether any right-side panel is active (form or detail) */
  isSidePanelOpen: boolean;
  /** Open the side panel in create mode */
  openPanel: () => void;
  /** Open the side panel in edit mode */
  openPanelEdit: (chore: Chore) => void;
  /** Open the quick-add command palette */
  openPalette: () => void;
  /** Open the detail panel for a chore */
  openDetail: (chore: ChoreWithDue | Chore) => void;
  /** Close whatever is currently open */
  close: () => void;

  // Legacy aliases for backward compatibility
  /** @deprecated Use isPanelOpen */
  isOpen: boolean;
  /** @deprecated Use openPanel */
  openCreate: () => void;
  /** @deprecated Use openPanelEdit */
  openEdit: (chore: Chore) => void;
}

const ChoreFormContext = createContext<ChoreFormContextValue | null>(null);

export function ChoreFormProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChoreFormMode>(null);
  const [chore, setChore] = useState<Chore | null>(null);
  const [detailChore, setDetailChore] = useState<ChoreWithDue | Chore | null>(null);

  const openPanel = useCallback(() => {
    setChore(null);
    setDetailChore(null);
    setMode("panel");
  }, []);

  const openPanelEdit = useCallback((choreToEdit: Chore) => {
    setChore(choreToEdit);
    setDetailChore(null);
    setMode("panel");
  }, []);

  const openPalette = useCallback(() => {
    setChore(null);
    setDetailChore(null);
    setMode("palette");
  }, []);

  const openDetail = useCallback((choreToView: ChoreWithDue | Chore) => {
    setDetailChore(choreToView);
    setChore(null);
    setMode("detail");
  }, []);

  const close = useCallback(() => {
    setMode(null);
    // Delay clearing state to allow exit animation
    setTimeout(() => {
      setChore(null);
      setDetailChore(null);
    }, 300);
  }, []);

  const isPanelOpen = mode === "panel";
  const isPaletteOpen = mode === "palette";
  const isDetailOpen = mode === "detail";
  const isSidePanelOpen = isPanelOpen || isDetailOpen;

  return (
    <ChoreFormContext.Provider
      value={{
        mode,
        chore,
        detailChore,
        isPanelOpen,
        isPaletteOpen,
        isDetailOpen,
        isSidePanelOpen,
        openPanel,
        openPanelEdit,
        openPalette,
        openDetail,
        close,
        // Legacy aliases
        isOpen: isPanelOpen,
        openCreate: openPanel,
        openEdit: openPanelEdit,
      }}
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
