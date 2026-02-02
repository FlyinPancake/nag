import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { ChoreCard, ChoreCardSkeleton } from "@/components/chore-card";
import { ChoreDetail } from "@/components/chore-detail";
import { EmptyState } from "@/components/empty-state";
import { useDueChores, useCompleteChore } from "@/hooks/use-chores";
import { useChoreForm } from "@/hooks/use-chore-form";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { openCreate } = useChoreForm();
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);
  const { data: chores, isLoading, error } = useDueChores(true);
  const completeChore = useCompleteChore();

  // Separate overdue and upcoming chores
  const overdueChores = chores?.filter((c) => c.is_overdue) ?? [];
  const upcomingChores = chores?.filter((c) => !c.is_overdue) ?? [];
  const hasChores = (chores?.length ?? 0) > 0;

  const selectedChore = chores?.find((c) => c.id === selectedChoreId) ?? null;

  const handleComplete = async (id: string) => {
    const chore = chores?.find((c) => c.id === id);
    try {
      await completeChore.mutateAsync({ id });
      toast.success(`${chore?.name ?? "Chore"} completed!`, {
        action: {
          label: "Add note",
          onClick: () => {
            // TODO: Open note dialog
            toast.info("Note feature coming soon!");
          },
        },
      });
    } catch {
      toast.error("Failed to complete chore");
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          Failed to load chores. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Loading...
            </h2>
            <div className="space-y-3">
              <ChoreCardSkeleton />
              <ChoreCardSkeleton />
              <ChoreCardSkeleton />
            </div>
          </section>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasChores && (
        <EmptyState onAction={openCreate} />
      )}

      {/* Overdue section */}
      {!isLoading && overdueChores.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-overdue" />
            <h2 className="text-sm font-semibold text-overdue uppercase tracking-wider">
              Overdue ({overdueChores.length})
            </h2>
          </div>
          <div className="space-y-3">
            {overdueChores.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                onComplete={handleComplete}
                onClick={() => setSelectedChoreId(chore.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Coming up section */}
      {!isLoading && upcomingChores.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Coming Up
            </h2>
          </div>
          <div className="space-y-3">
            {upcomingChores.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                onComplete={handleComplete}
                onClick={() => setSelectedChoreId(chore.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Chore detail panel */}
      <ChoreDetail
        chore={selectedChore}
        open={!!selectedChoreId}
        onOpenChange={(open) => !open && setSelectedChoreId(null)}
        onComplete={handleComplete}
      />
    </div>
  );
}
