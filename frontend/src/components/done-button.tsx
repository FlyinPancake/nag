import { useState, useRef, useCallback } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DoneButtonProps {
  onDone: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  /** Use hero variant for prominent placement */
  variant?: "default" | "hero";
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  velocity: number;
  size: number;
}

export function DoneButton({ onDone, disabled, className, variant = "default" }: DoneButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [particles, setParticles] = useState<Particle[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const particleIdRef = useRef(0);

  const createParticles = useCallback(() => {
    const colors = [
      "var(--color-success)",
      "var(--color-primary)",
      "var(--color-warning)",
      "#FFD700",
      "#FF69B4",
      "#00CED1",
    ];

    const newParticles: Particle[] = [];
    const particleCount = variant === "hero" ? 24 : 12;

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: 50,
        y: 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5,
        velocity: 2 + Math.random() * 3,
        size: 4 + Math.random() * 4,
      });
    }

    setParticles(newParticles);

    // Clear particles after animation
    setTimeout(() => setParticles([]), 800);
  }, [variant]);

  const handleClick = async () => {
    if (state !== "idle" || disabled) return;

    setState("loading");
    try {
      await onDone();
      setState("success");
      createParticles();
      // Reset after animation completes
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  };

  const isHero = variant === "hero";

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled || state === "loading"}
      className={cn(
        // Base styles
        "relative overflow-visible font-semibold transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.97]",

        // Variant styles
        isHero
          ? [
              // Hero variant - large, prominent, full-width
              "w-full h-14 rounded-2xl text-base",
              "flex items-center justify-center gap-3",
              state === "success"
                ? "bg-success text-success-foreground shadow-lg shadow-success/25"
                : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]",
            ]
          : [
              // Default variant - compact
              "h-9 px-4 rounded-lg text-sm",
              "inline-flex items-center justify-center gap-2",
              state === "success"
                ? "bg-success text-success-foreground"
                : "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
            ],

        className,
      )}
    >
      {/* Ripple effect on success */}
      {state === "success" && (
        <span
          className={cn("absolute inset-0 rounded-[inherit]", "animate-ripple-out bg-success/30")}
        />
      )}

      {/* Confetti particles */}
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute pointer-events-none animate-confetti-burst"
          style={
            {
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              transform: `rotate(${Math.random() * 360}deg)`,
              "--confetti-angle": `${particle.angle}rad`,
              "--confetti-velocity": particle.velocity,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {state === "loading" ? (
          <Loader2 className={cn("animate-spin", isHero ? "h-6 w-6" : "h-4 w-4")} />
        ) : state === "success" ? (
          <>
            <Check className={cn("animate-check-bounce", isHero ? "h-6 w-6" : "h-4 w-4")} />
            {isHero && <span className="animate-pop-in">Done!</span>}
          </>
        ) : (
          <>
            {isHero ? (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Mark as Done</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Done</span>
              </>
            )}
          </>
        )}
      </span>
    </button>
  );
}
