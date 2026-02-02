import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Optional badge/count to show next to title */
  badge?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
  className,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined
  );
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", className)}>
      {/* Header - clickable */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-3 p-4",
          "text-left transition-colors hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="text-muted-foreground shrink-0">{icon}</span>
          )}
          <span className="font-medium text-sm">{title}</span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Content - animated */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-250 ease-out",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: isOpen ? contentHeight : 0,
        }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
