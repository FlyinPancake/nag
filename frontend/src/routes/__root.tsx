import { useEffect } from "react";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Plus, ListTodo, Tags } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { UserMenu } from "@/components/user-menu";
import { QuickAddPalette } from "@/components/quick-add-palette";
import { ChoreFormPanel } from "@/components/chore-form-panel";
import { ChoreDetailPanel } from "@/components/chore-detail-panel";
import { ChoreFormProvider, useChoreForm } from "@/hooks/use-chore-form";
import { useCompleteChore } from "@/hooks/use-chores";
import { cn } from "@/lib/utils";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ChoreFormProvider>
      <RootLayoutInner />
    </ChoreFormProvider>
  );
}

function RootLayoutInner() {
  const {
    isPanelOpen,
    isPaletteOpen,
    isDetailOpen,
    isSidePanelOpen,
    chore,
    detailChore,
    openPanel,
    openPalette,
    close,
  } = useChoreForm();

  const completeChore = useCompleteChore();

  // Global Cmd/Ctrl+K keyboard shortcut for quick-add palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isPaletteOpen) {
          close();
        } else {
          openPalette();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPaletteOpen, openPalette, close]);

  const handleComplete = async (id: string) => {
    try {
      await completeChore.mutateAsync({ id });
      toast.success("Chore completed!");
    } catch {
      toast.error("Failed to complete chore");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b bg-background/92 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-[52px]">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                to="/"
                className="font-serif text-xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity"
              >
                Nag
              </Link>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <Link to="/chores">
                <Button variant="ghost" size="icon" aria-label="View all chores">
                  <ListTodo className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/tags">
                <Button variant="ghost" size="icon" aria-label="Manage tags">
                  <Tags className="h-5 w-5" />
                </Button>
              </Link>
              <DarkModeToggle />
              <UserMenu />
              {/* Cmd+K hint */}
              <kbd className="hidden lg:inline-flex items-center gap-0.5 bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-[0.65rem] font-mono border cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={openPalette}
              >
                <span className="text-[0.6rem]">&#8984;</span>K
              </kbd>
              <Button size="sm" className="gap-1.5 rounded-full" onClick={openPanel}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Chore</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content area + side panel flex container */}
      <div className="flex h-[calc(100vh-52px)] overflow-hidden">
        {/* Main content — shrinks when any side panel opens */}
        <main
          className={cn(
            "flex-1 min-w-0 overflow-y-auto transition-all duration-300 ease-in-out",
            isSidePanelOpen && "hidden md:block",
          )}
        >
          <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>

        {/* Side panel slot: form OR detail (only one at a time) */}
        <ChoreFormPanel
          open={isPanelOpen}
          chore={chore}
          onClose={close}
        />
        <ChoreDetailPanel
          open={isDetailOpen}
          chore={detailChore}
          onClose={close}
          onComplete={handleComplete}
        />
      </div>

      {/* Quick-add command palette (floating overlay, independent of layout) */}
      <QuickAddPalette
        open={isPaletteOpen}
        onClose={close}
      />

      {/* Toast notifications */}
      <Toaster position="bottom-center" />

      {/* Devtools (only in development) */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
}
