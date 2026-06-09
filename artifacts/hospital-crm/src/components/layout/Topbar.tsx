import { 
  useGetHospital, 
  useGetWallet, 
  useListNotifications, 
  useMarkNotificationRead, 
  useGetSessionRole,
  useSetSessionRole 
} from "@workspace/api-client-react";
import { Bell, Wallet, User as UserIcon, LogOut, Check } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { data: hospital } = useGetHospital();
  const { data: wallet } = useGetWallet();
  const { data: notifications } = useListNotifications();
  const { data: session } = useGetSessionRole();
  
  const setRoleMutation = useSetSessionRole();
  const markReadMutation = useMarkNotificationRead();

  const isLowBalance = wallet && wallet.balance < 5000;
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const handleRoleChange = (role: 'exec' | 'manager' | 'ap_admin') => {
    setRoleMutation.mutate({ data: { role } });
  };

  const roleDisplay = {
    'exec': 'Front-office Exec',
    'manager': 'Marketing Manager',
    'ap_admin': 'Affordplan Admin'
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {hospital?.name || "Hospital Loading..."}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Wallet Balance Chip */}
        {wallet && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium",
            isLowBalance 
              ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:border-orange-900 dark:text-orange-400" 
              : "bg-secondary border-border text-secondary-foreground"
          )}>
            <Wallet className="w-4 h-4" />
            <span>₹{wallet.balance.toLocaleString('en-IN')}</span>
          </div>
        )}

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"></span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b flex items-center justify-between">
              <h4 className="font-semibold text-sm">Notifications</h4>
              <Badge variant="secondary">{unreadCount} unread</Badge>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">No notifications</div>
              ) : (
                notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={cn(
                      "p-3 border-b last:border-0 text-sm flex gap-3 cursor-pointer hover:bg-muted/50 transition-colors",
                      !notification.read ? "bg-primary/5" : ""
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        markReadMutation.mutate({ id: notification.id });
                      }
                    }}
                  >
                    <div className="flex-1 space-y-1">
                      <p className={cn("font-medium", !notification.read ? "text-foreground" : "text-muted-foreground")}>
                        {notification.title}
                      </p>
                      <p className="text-muted-foreground text-xs">{notification.body}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-1.5"></div>
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
            <Button variant="outline" className="gap-2">
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline-block">
                {session ? roleDisplay[session.role as keyof typeof roleDisplay] : 'Loading...'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleRoleChange('exec')}
              className="flex items-center justify-between cursor-pointer"
            >
              <span>Front-office Exec</span>
              {session?.role === 'exec' && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleRoleChange('manager')}
              className="flex items-center justify-between cursor-pointer"
            >
              <span>Marketing Manager</span>
              {session?.role === 'manager' && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleRoleChange('ap_admin')}
              className="flex items-center justify-between cursor-pointer"
            >
              <span>Affordplan Admin</span>
              {session?.role === 'ap_admin' && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
