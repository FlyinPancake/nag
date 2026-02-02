import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Calendar, Pencil, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChoreDetail } from "@/components/chore-detail";
import { EmptyState } from "@/components/empty-state";
import { useChores, useDueChores, useDeleteChore, useCompleteChore } from "@/hooks/use-chores";
import { useChoreForm } from "@/hooks/use-chore-form";
import { formatCronHuman, formatIntervalHuman } from "@/lib/cron";
import { formatRelativeTime, isToday } from "@/lib/date";
import type { Chore, ChoreWithDue } from "@/lib/api";

export const Route = createFileRoute("/chores")({
  component: ChoresPage,
});

type FilterTab = "all" | "overdue" | "today" | "upcoming";

function ChoresPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);

  const { openCreate, openEdit } = useChoreForm();
  const { data: allChoresData, isLoading: isLoadingAll } = useChores();
  const { data: dueChores, isLoading: isLoadingDue } = useDueChores(true);
  const deleteChore = useDeleteChore();
  const completeChore = useCompleteChore();

  const isLoading = isLoadingAll || isLoadingDue;
  const allChores = allChoresData?.items ?? [];

  // Create a map of due info by chore id
  const dueInfoMap = new Map<string, ChoreWithDue>();
  dueChores?.forEach((c) => dueInfoMap.set(c.id, c));

  // Filter chores based on active tab
  const getFilteredChores = (): Chore[] => {
    switch (activeTab) {
      case "overdue":
        return allChores.filter((c) => dueInfoMap.get(c.id)?.is_overdue);
      case "today":
        return allChores.filter((c) => {
          const due = dueInfoMap.get(c.id);
          return due?.next_due && isToday(due.next_due);
        });
      case "upcoming":
        return allChores.filter((c) => {
          const due = dueInfoMap.get(c.id);
          return due && !due.is_overdue && due.next_due && !isToday(due.next_due);
        });
      default:
        return allChores;
    }
  };

  const filteredChores = getFilteredChores();
  const selectedChore = selectedChoreId
    ? (dueInfoMap.get(selectedChoreId) ?? allChores.find((c) => c.id === selectedChoreId) ?? null)
    : null;

  // Count badges
  const overdueCount = allChores.filter((c) => dueInfoMap.get(c.id)?.is_overdue).length;
  const todayCount = allChores.filter((c) => {
    const due = dueInfoMap.get(c.id);
    return due?.next_due && isToday(due.next_due);
  }).length;

  const handleComplete = async (id: string) => {
    const chore = allChores.find((c) => c.id === id);
    try {
      await completeChore.mutateAsync({ id });
      toast.success(`${chore?.name ?? "Chore"} completed!`);
    } catch {
      toast.error("Failed to complete chore");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteChore.mutateAsync(id);
      if (selectedChoreId === id) {
        setSelectedChoreId(null);
      }
      toast.success("Chore deleted");
    } catch {
      toast.error("Failed to delete chore");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="icon" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">All Chores</h1>
      </div>

      {/* Filter tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {allChores.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            {overdueCount > 0 && (
              <Badge variant="overdue" className="ml-1.5 h-5 px-1.5 text-xs">
                {overdueCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today">
            Today
            {todayCount > 0 && (
              <Badge variant="dueToday" className="ml-1.5 h-5 px-1.5 text-xs">
                {todayCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredChores.length === 0 && (
            <EmptyState
              title={
                activeTab === "all"
                  ? "No chores yet"
                  : activeTab === "overdue"
                    ? "Nothing overdue!"
                    : activeTab === "today"
                      ? "Nothing due today"
                      : "No upcoming chores"
              }
              description={
                activeTab === "all"
                  ? "Create your first chore to get started."
                  : "You're all caught up!"
              }
              actionLabel={activeTab === "all" ? "Add First Chore" : undefined}
              onAction={activeTab === "all" ? openCreate : undefined}
            />
          )}

          {/* Chore list */}
          {!isLoading && filteredChores.length > 0 && (
            <div className="space-y-2">
              {filteredChores.map((chore) => {
                const dueInfo = dueInfoMap.get(chore.id);
                const isOverdue = dueInfo?.is_overdue;
                const nextDue = dueInfo?.next_due;
                const isDueToday = nextDue && isToday(nextDue);

                return (
                  <Card
                    key={chore.id}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedChoreId(chore.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{chore.name}</h3>
                          {isOverdue && (
                            <Badge variant="overdue" className="shrink-0">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                          {isDueToday && !isOverdue && (
                            <Badge variant="dueToday" className="shrink-0">
                              Due today
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {chore.schedule_type === "interval" && chore.interval_days != null
                              ? formatIntervalHuman(
                                  chore.interval_days,
                                  chore.interval_time_hour,
                                  chore.interval_time_minute,
                                )
                              : formatCronHuman(chore.cron_schedule ?? "")}
                          </span>
                          {nextDue && (
                            <>
                              <span className="mx-1">·</span>
                              <span className="shrink-0">{formatRelativeTime(nextDue)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(chore)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(chore.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
