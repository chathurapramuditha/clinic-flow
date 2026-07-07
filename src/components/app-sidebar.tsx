import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  Stethoscope,
  Users,
  Activity,
  LogOut,
  ShieldCheck,
} from "lucide-react";


import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/auth-context";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Therapists", url: "/therapists", icon: Stethoscope },
  { title: "Patients", url: "/patients", icon: Users },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  const primaryRole = roles.includes("admin")
    ? "Admin"
    : roles.includes("therapist")
      ? "Therapist"
      : roles.includes("patient")
        ? "Patient"
        : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-bold tracking-tight text-foreground">
              PhysioSchedule
            </div>
            <div className="truncate text-xs text-muted-foreground">Physiotherapy Dept.</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <div className="rounded-lg border bg-muted/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{user.email}</p>
                  {primaryRole && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {primaryRole}
                    </Badge>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
