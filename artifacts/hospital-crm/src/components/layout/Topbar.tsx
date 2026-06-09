import {
  useGetHospital,
  useGetWallet,
  useListNotifications,
  useMarkNotificationRead,
  useGetSessionRole,
  useSetSessionRole,
} from "@workspace/api-client-react";
import { Bell, Wallet, User as UserIcon, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function Topbar() {
  const { data: hospital } = useGetHospital();
  const { data: wallet } = useGetWallet();
  const { data: notifications } = useListNotifications();
  const { data: session } = useGetSessionRole();
  const queryClient = useQueryClient();

  const setRoleMutation = useSetSessionRole();
  const markReadMutation = useMarkNotificationRead();

  const isLowBalance = wallet && parseFloat(String(wallet.balance)) < 5000;
  const unreadCount = notifications?.filter(n => String(n.read) !== "true" && n.read !== true).length || 0;

  const handleRoleChange = (role: "exec" | "manager" | "ap_admin") => {
    setRoleMutation.mutate(
      { data: { role } },
      {
        onSuccess: () => {
          // Invalidate ALL queries so every component sees the new role
          queryClient.invalidateQueries();
        },
      }
    );
  };

  const roleDisplay: Record<string, string> = {
    exec: "Front-office Exec",
    manager: "Marketing Manager",
    ap_admin: "Affordplan Admin",
  };

  const roleColor: Record<string, string> = {
    exec: "border-slate-300",
    manager: "border-blue-300",
    ap_admin: "border-purple-300",
  };

  const currentRole = session?.role ?? "exec";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground tracking-tight">
          {hospital?.name || "Loading…"}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Wallet Balance Chip */}
        {wallet && (
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium",
              isLowBalance
                ? "bg-orange-50 border-orange-200 text-orange-700"
                : "bg-secondary border-border text-secondary-foreground"
            )}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>₹{parseFloat(String(wallet.balance)).toLocaleString("en-IN")}</span>
          </div>
        )}

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b flex items-center justify-between">
              <h4 className="font-semibold text-sm">Notifications</h4>
              <Badge variant="secondary" className="text-xs">{unreadCount} unread</Badge>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!notifications?.length ? (
                <div className="p-4 text-center text-muted-foreground text-sm">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 border-b last:border-0 text-sm flex gap-3 cursor-pointer hover:bg-muted/50",
                      String(n.read) !== "true" && n.read !== (true as any) ? "bg-primary/5" : ""
                    )}
                    onClick={() => {
                      if (String(n.read) !== "true" && n.read !== (true as any)) markReadMutation.mutate({ id: n.id });
                    }}
                  >
                    <div className="flex-1 space-y-0.5">
                      <p className={cn("font-medium", String(n.read) !== "true" && n.read !== (true as any) ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                      <p className="text-muted-foreground text-xs">{n.body}</p>
                    </div>
                    {String(n.read) !== "true" && n.read !== (true as any) && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Role Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2 text-xs h-8 border-2", roleColor[currentRole])}
              disabled={setRoleMutation.isPending}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline-block">
                {session ? roleDisplay[currentRole] : "Loading…"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Demo Role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["exec", "manager", "ap_admin"] as const).map(role => (
              <DropdownMenuItem
                key={role}
                onClick={() => handleRoleChange(role)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-medium text-sm">{roleDisplay[role]}</div>
                  <div className="text-xs text-muted-foreground">
                    {role === "exec" && "Can reply, create, assign"}
                    {role === "manager" && "Can approve, add funds"}
                    {role === "ap_admin" && "Full platform access"}
                  </div>
                </div>
                {currentRole === role && <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
