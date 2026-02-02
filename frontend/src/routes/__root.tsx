import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Plus, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { ChoreForm } from "@/components/chore-form";
import { ChoreFormProvider, useChoreForm } from "@/hooks/use-chore-form";
import { useCreateChore, useUpdateChore } from "@/hooks/use-chores";
import type { CreateChoreRequest, UpdateChoreRequest } from "@/lib/api";

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
  const { isOpen, chore, openCreate, close } = useChoreForm();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();

  const handleSubmit = async (data: CreateChoreRequest | UpdateChoreRequest) => {
    if (chore) {
      await updateChore.mutateAsync({ id: chore.id, data: data as UpdateChoreRequest });
      toast.success("Chore updated!");
    } else {
      await createChore.mutateAsync(data as CreateChoreRequest);
      toast.success("Chore created!");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-14">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                to="/"
                className="text-xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity"
              >
                Nag
              </Link>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <Link to="/chores">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View all chores"
                >
                  <ListTodo className="h-5 w-5" />
                </Button>
              </Link>
              <DarkModeToggle />
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Chore</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* Global chore form */}
      <ChoreForm
        open={isOpen}
        onOpenChange={(open) => !open && close()}
        chore={chore}
        onSubmit={handleSubmit}
      />

      {/* Toast notifications */}
      <Toaster position="bottom-center" />

      {/* Devtools (only in development) */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
}
