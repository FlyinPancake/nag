import { useState, useMemo } from "react";
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
import { EmptyState } from "@/components/empty-state";
import { useChores, useDueChores, useDeleteChore } from "@/hooks/use-chores";
import { useChoreForm } from "@/hooks/use-chore-form";
import { formatCronHuman, formatIntervalHuman } from "@/lib/cron";
import { formatRelativeTime, isToday } from "@/lib/date";
import { cn } from "@/lib/utils";
import { tagBadgeStyle, tagDotStyle, resolveTagColorKey } from "@/lib/tag-colors";
import type { Chore, ChoreWithDue, Tag } from "@/lib/api";

export const Route = createFileRoute("/chores")({
  component: ChoresPage,
});

type FilterTab = "all" | "overdue" | "today" | "upcoming";

function ChoresPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { openCreate, openEdit, openDetail } = useChoreForm();
  const { data: allChoresData, isLoading: isLoadingAll } = useChores();
  const { data: dueChores, isLoading: isLoadingDue } = useDueChores(true);
  const deleteChore = useDeleteChore();

  const isLoading = isLoadingAll || isLoadingDue;
  const allChoresItems = allChoresData?.items;

  // Collect unique tags from all chores
  const allTags = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    for (const c of allChoresItems ?? []) {
      for (const t of c.tags ?? []) {
        tagMap.set(t.id, t);
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allChoresItems]);

  // Apply tag filter first
  const tagFilteredChores = useMemo(() => {
    const items = allChoresItems ?? [];
    if (!selectedTag) return items;
    return items.filter((c) => c.tags?.some((t) => t.name === selectedTag));
  }, [allChoresItems, selectedTag]);

  // Create a map of due info by chore id
  const dueInfoMap = new Map<string, ChoreWithDue>();
  dueChores?.forEach((c) => dueInfoMap.set(c.id, c));

  // Filter chores based on active tab (applied after tag filter)
  const getFilteredChores = (): Chore[] => {
    switch (activeTab) {
      case "overdue":
        return tagFilteredChores.filter((c) => dueInfoMap.get(c.id)?.is_overdue);
      case "today":
        return tagFilteredChores.filter((c) => {
          const due = dueInfoMap.get(c.id);
          return due?.next_due && isToday(due.next_due);
        });
      case "upcoming":
        return tagFilteredChores.filter((c) => {
          const due = dueInfoMap.get(c.id);
          return due && !due.is_overdue && due.next_due && !isToday(due.next_due);
        });
      default:
        return tagFilteredChores;
    }
  };

  const filteredChores = getFilteredChores();
  // Count badges (reflect tag filter)
  const overdueCount = tagFilteredChores.filter((c) => dueInfoMap.get(c.id)?.is_overdue).length;
  const todayCount = tagFilteredChores.filter((c) => {
    const due = dueInfoMap.get(c.id);
    return due?.next_due && isToday(due.next_due);
  }).length;

  const handleDelete = async (id: string) => {
    try {
      await deleteChore.mutateAsync(id);
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

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
              selectedTag === null
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:bg-secondary",
            )}
          >
            All tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() =>
                setSelectedTag(selectedTag === tag.name ? null : tag.name)
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
                selectedTag === tag.name
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:bg-secondary",
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={tagDotStyle(resolveTagColorKey(tag.color, tag.name))}
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {tagFilteredChores.length}
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
                    onClick={() => openDetail(dueInfoMap.get(chore.id) ?? chore)}
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
                        {chore.tags && chore.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {chore.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full border px-1.5 py-0 text-[0.6rem] font-semibold"
                                style={tagBadgeStyle(tag.color, tag.name)}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
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

    </div>
  );
}
