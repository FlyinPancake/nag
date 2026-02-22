import { useState, useRef, useCallback, useEffect } from "react";

import { X, Plus } from "lucide-react";

import { useTags, useUpdateTag } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";
import {
  TAG_COLORS,
  tagBadgeStyle,
  tagDotStyle,
  resolveTagColorKey,
} from "@/lib/tag-colors";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Optional map of tag name -> color key, used for new tag color selection */
  newTagColors?: Map<string, string>;
  onNewTagColor?: (name: string, color: string) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  newTagColors,
  onNewTagColor,
  placeholder = "Add tag...",
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [colorPickerTagId, setColorPickerTagId] = useState<string | null>(null);
  const [newTagColor, setNewTagColor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTags = [] } = useTags();
  const updateTag = useUpdateTag();

  // Build a lookup for tag colors from allTags
  const tagColorMap = new Map(
    allTags.map((t) => [t.name.toLowerCase(), { color: t.color, id: t.id }]),
  );

  // Filter suggestions: exclude already-selected tags, match input text
  const suggestions = allTags.filter((tag) => {
    const alreadySelected = value.some(
      (v) => v.toLowerCase() === tag.name.toLowerCase(),
    );
    if (alreadySelected) return false;
    if (!inputValue.trim()) return true;
    return tag.name.toLowerCase().includes(inputValue.toLowerCase());
  });

  // Check if input text is a new tag (doesn't exist yet)
  const trimmedInput = inputValue.trim();
  const isNewTag =
    trimmedInput.length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === trimmedInput.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === trimmedInput.toLowerCase());

  const addTag = useCallback(
    (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed) return;
      if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
      onChange([...value, trimmed]);
      setInputValue("");
      setIsOpen(false);
      setHighlightedIndex(-1);
      setNewTagColor(null);
    },
    [value, onChange],
  );

  const removeTag = useCallback(
    (tagName: string) => {
      onChange(value.filter((v) => v.toLowerCase() !== tagName.toLowerCase()));
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (isNewTag ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev < totalItems - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : totalItems - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        addTag(suggestions[highlightedIndex].name);
      } else if (
        isNewTag &&
        (highlightedIndex === suggestions.length || highlightedIndex === -1)
      ) {
        // Store color preference for this new tag
        if (newTagColor && onNewTagColor) {
          onNewTagColor(trimmedInput, newTagColor);
        }
        addTag(trimmedInput);
      } else if (trimmedInput) {
        if (newTagColor && onNewTagColor) {
          onNewTagColor(trimmedInput, newTagColor);
        }
        addTag(trimmedInput);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      setColorPickerTagId(null);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        setColorPickerTagId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleColorChange = (tagId: string, colorKey: string) => {
    updateTag.mutate({ id: tagId, data: { color: colorKey } });
    setColorPickerTagId(null);
  };

  const showDropdown = isOpen && (suggestions.length > 0 || isNewTag);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input area with tag chips */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2.5",
          "focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent",
          "min-h-[42px] cursor-text",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => {
          const info = tagColorMap.get(tag.toLowerCase());
          const colorKey = info?.color ?? newTagColors?.get(tag.toLowerCase()) ?? null;
          return (
            <div
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              style={tagBadgeStyle(colorKey, tag)}
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
            setColorPickerTagId(null);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none focus-visible:!outline-none focus-visible:!outline-offset-0 placeholder:text-muted-foreground"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
          <ul className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((tag, index) => (
              <li key={tag.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors",
                    highlightedIndex === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(tag.name);
                  }}
                >
                  {/* Color dot */}
                  <button
                    type="button"
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-border hover:ring-foreground/40 transition-all"
                    style={tagDotStyle(resolveTagColorKey(tag.color, tag.name))}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColorPickerTagId(
                        colorPickerTagId === tag.id ? null : tag.id,
                      );
                    }}
                  />
                  <span className="flex-1">{tag.name}</span>
                </div>
                {/* Inline color picker for this tag */}
                {colorPickerTagId === tag.id && (
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/30">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className={cn(
                          "w-4 h-4 rounded-full transition-all ring-1",
                          resolveTagColorKey(tag.color, tag.name) === c.key
                            ? "ring-foreground scale-110"
                            : "ring-border hover:ring-foreground/40 hover:scale-110",
                        )}
                        style={tagDotStyle(c.key)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleColorChange(tag.id, c.key);
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
            {isNewTag && (
              <li>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors",
                    highlightedIndex === suggestions.length
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                  onMouseEnter={() =>
                    setHighlightedIndex(suggestions.length)
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (newTagColor && onNewTagColor) {
                      onNewTagColor(trimmedInput, newTagColor);
                    }
                    addTag(trimmedInput);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    Create{" "}
                    <span className="font-semibold">
                      &ldquo;{trimmedInput}&rdquo;
                    </span>
                  </span>
                </div>
                {/* Color swatch row for new tag */}
                <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/30">
                  <span className="text-[0.65rem] text-muted-foreground mr-1">
                    Color:
                  </span>
                  {TAG_COLORS.map((c) => {
                    const autoKey = resolveTagColorKey(null, trimmedInput);
                    const isSelected = newTagColor
                      ? newTagColor === c.key
                      : autoKey === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={cn(
                          "w-4 h-4 rounded-full transition-all ring-1",
                          isSelected
                            ? "ring-foreground scale-110"
                            : "ring-border hover:ring-foreground/40 hover:scale-110",
                        )}
                        style={tagDotStyle(c.key)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNewTagColor(c.key);
                          if (onNewTagColor) {
                            onNewTagColor(trimmedInput, c.key);
                          }
                        }}
                        title={c.label}
                      />
                    );
                  })}
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
