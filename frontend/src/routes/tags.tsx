import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";
import {
  TAG_COLORS,
  tagBadgeStyle,
  tagDotStyle,
  resolveTagColorKey,
} from "@/lib/tag-colors";
import type { Tag } from "@/lib/api";

export const Route = createFileRoute("/tags")({
  component: TagsPage,
});

// ---------------------------------------------------------------------------
// Inline tag editor row
// ---------------------------------------------------------------------------

interface TagRowProps {
  tag: Tag;
}

function TagRow({ tag }: TagRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [editColor, setEditColor] = useState<string | null>(tag.color);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditName(tag.name);
    setEditColor(tag.color);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setShowColorPicker(false);
  };

  const saveEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Tag name cannot be empty");
      return;
    }

    const nameChanged = trimmed !== tag.name;
    const colorChanged = editColor !== tag.color;

    if (!nameChanged && !colorChanged) {
      cancelEditing();
      return;
    }

    try {
      await updateTag.mutateAsync({
        id: tag.id,
        data: {
          ...(nameChanged ? { name: trimmed } : {}),
          ...(colorChanged ? { color: editColor } : {}),
        },
      });
      toast.success("Tag updated");
      setIsEditing(false);
      setShowColorPicker(false);
    } catch {
      toast.error("Failed to update tag");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTag.mutateAsync(tag.id);
      toast.success(`Tag "${tag.name}" deleted`);
    } catch {
      toast.error("Failed to delete tag");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const resolvedColor = resolveTagColorKey(
    isEditing ? editColor : tag.color,
    isEditing ? editName || tag.name : tag.name,
  );

  if (isEditing) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          {/* Color dot (click to toggle picker) */}
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-6 h-6 rounded-full shrink-0 ring-1 ring-border hover:ring-foreground/40 transition-all"
            style={tagDotStyle(resolvedColor)}
            title="Change color"
          />
          {/* Name input */}
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-1.5",
              "text-base md:text-sm text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            )}
          />
          {/* Save / Cancel */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={saveEdit}
              disabled={updateTag.isPending}
              aria-label="Save"
            >
              <Check className="h-4 w-4 text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={cancelEditing}
              aria-label="Cancel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {/* Inline color picker */}
        {showColorPicker && (
          <div className="flex items-center gap-2.5 md:gap-1.5 mt-3 pt-3 border-t border-border flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Color:</span>
            {TAG_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setEditColor(c.key)}
                className={cn(
                  "w-7 h-7 md:w-5 md:h-5 rounded-full transition-all ring-1",
                  (editColor ?? resolvedColor) === c.key
                    ? "ring-foreground scale-110"
                    : "ring-border hover:ring-foreground/40 hover:scale-110",
                )}
                style={tagDotStyle(c.key)}
                title={c.label}
              />
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-4 group hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        {/* Color dot */}
        <span
          className="w-4 h-4 rounded-full shrink-0 ring-1 ring-border"
          style={tagDotStyle(resolvedColor)}
        />
        {/* Tag badge preview */}
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
          style={tagBadgeStyle(tag.color, tag.name)}
        >
          {tag.name}
        </span>
        {/* Spacer */}
        <div className="flex-1" />
        {/* Actions (visible on hover / always on mobile) */}
        <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={startEditing}
            aria-label="Edit tag"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={deleteTag.isPending}
            className="text-destructive hover:text-destructive"
            aria-label="Delete tag"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create new tag inline
// ---------------------------------------------------------------------------

function CreateTagRow() {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTag = useCreateTag();

  useEffect(() => {
    if (isCreating) {
      inputRef.current?.focus();
    }
  }, [isCreating]);

  const resolvedColor = resolveTagColorKey(color, name || "new");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Tag name cannot be empty");
      return;
    }
    try {
      await createTag.mutateAsync({
        name: trimmed,
        ...(color ? { color } : {}),
      });
      toast.success(`Tag "${trimmed}" created`);
      setName("");
      setColor(null);
      setShowColorPicker(false);
      setIsCreating(false);
    } catch {
      toast.error("Failed to create tag");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setName("");
      setColor(null);
      setShowColorPicker(false);
    }
  };

  if (!isCreating) {
    return (
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg border border-dashed border-border p-4",
          "text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30",
          "transition-colors cursor-pointer",
        )}
      >
        <Plus className="h-4 w-4" />
        Create new tag
      </button>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        {/* Color dot */}
        <button
          type="button"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-6 h-6 rounded-full shrink-0 ring-1 ring-border hover:ring-foreground/40 transition-all"
          style={tagDotStyle(resolvedColor)}
          title="Pick color"
        />
        {/* Name input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tag name..."
          className={cn(
            "flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-1.5",
            "text-base md:text-sm text-foreground placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          )}
        />
        {/* Save / Cancel */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCreate}
            disabled={createTag.isPending}
            aria-label="Create tag"
          >
            <Check className="h-4 w-4 text-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setIsCreating(false);
              setName("");
              setColor(null);
              setShowColorPicker(false);
            }}
            aria-label="Cancel"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {/* Inline color picker */}
      {showColorPicker && (
        <div className="flex items-center gap-2.5 md:gap-1.5 mt-3 pt-3 border-t border-border flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Color:</span>
          {TAG_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              className={cn(
                "w-7 h-7 md:w-5 md:h-5 rounded-full transition-all ring-1",
                (color ?? resolvedColor) === c.key
                  ? "ring-foreground scale-110"
                  : "ring-border hover:ring-foreground/40 hover:scale-110",
              )}
              style={tagDotStyle(c.key)}
              title={c.label}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tags page
// ---------------------------------------------------------------------------

function TagsPage() {
  const { data: tags, isLoading } = useTags();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="icon" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Tags</h1>
        {tags && tags.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!tags || tags.length === 0) && (
        <EmptyState
          title="No tags yet"
          description="Create tags to organize your chores."
        />
      )}

      {/* Tag list */}
      {!isLoading && tags && tags.length > 0 && (
        <div className="space-y-2">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </div>
      )}

      {/* Create new tag */}
      {!isLoading && <CreateTagRow />}
    </div>
  );
}
