import { useState } from "react";

import { CircleUser, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

function UserAvatar({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <CircleUser className="h-5 w-5" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-6 w-6 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function UserMenu() {
  const { user, isLoading, isAuthenticated, authEnabled, logout } = useAuth();

  // Don't render anything when auth is disabled
  if (!authEnabled) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayName = user?.name || user?.email || "User";
  const displayEmail = user?.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="User menu">
          {user?.picture ? (
            <UserAvatar src={user.picture} alt={displayName} />
          ) : (
            <CircleUser className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {displayEmail && displayEmail !== displayName && (
              <p className="text-xs leading-none text-muted-foreground">
                {displayEmail}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
