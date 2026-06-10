import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CalendarCheck, 
  UserRound, 
  Inbox, 
  Upload, 
  Megaphone, 
  FileText, 
  Users, 
  BarChart, 
  ShieldCheck, 
  Building2, 
  Clock, 
  Wallet,
  Activity,
  Layers,
  MessageSquare,
  Tag,
  Mail,
} from "lucide-react";
import { useGetSessionRole } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Home",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Appointment Booking",
    items: [
      { title: "Dashboard", href: "/appointments/dashboard", icon: Activity },
      { title: "Bookings", href: "/appointments/bookings", icon: CalendarCheck },
      { title: "Doctors", href: "/appointments/doctors", icon: UserRound },
    ],
  },
  {
    title: "Lead Management",
    items: [
      { title: "Dashboard", href: "/crm/dashboard", icon: BarChart },
      { title: "Inbox", href: "/crm/inbox", icon: Inbox },
      { title: "CSV Upload", href: "/crm/csv-upload", icon: Upload },
    ],
  },
  {
    title: "Patient Engagement",
    items: [
      { title: "Dashboard", href: "/marketing/dashboard", icon: Megaphone },
      { title: "Campaigns", href: "/marketing/campaigns", icon: Layers },
      { title: "Templates", href: "/marketing/templates", icon: FileText },
      { title: "Segments", href: "/marketing/segments", icon: Users },
      { title: "Metrics", href: "/marketing/metrics", icon: BarChart },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Integrations", href: "/settings/integrations", icon: Building2 },
      { title: "Email Config", href: "/settings/email-config", icon: Mail },
      { title: "Send Rules", href: "/settings/send-rules", icon: Clock },
      { title: "Profile", href: "/settings/profile", icon: LayoutDashboard },
      { title: "Variables", href: "/settings/variables", icon: FileText },
      { title: "Tags", href: "/settings/tags", icon: Tag },
      { title: "Quick Replies", href: "/settings/quick-replies", icon: MessageSquare },
      { title: "Users", href: "/settings/users", icon: Users },
      { title: "Wallet", href: "/settings/wallet", icon: Wallet },
    ],
  },
  {
    title: "Super-Admin (Affordplan)",
    adminOnly: true,
    items: [
      { title: "Channels", href: "/super-admin/channels", icon: ShieldCheck },
      { title: "Templates", href: "/super-admin/templates", icon: FileText },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: session } = useGetSessionRole();

  const isAdmin = session?.role === "ap_admin";

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold">
          AP
        </div>
        <span className="font-bold text-lg tracking-tight">Affordplan</span>
      </div>

      <nav className="flex-1 p-4 space-y-6">
        {NAV_GROUPS.map((group) => {
          if (group.adminOnly && !isAdmin) return null;

          return (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/40 text-center">
          Hospital CRM v1.0
        </div>
      </div>
    </aside>
  );
}
