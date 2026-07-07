import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { AppRole } from "@/lib/types";
import { ShieldCheck, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [{ title: "User Management — PhysioSchedule" }],
  }),
  component: AdminUsersPage,
});

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  roles: AppRole[];
};

function AdminUsersPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error(error.message);
      setUsers([]);
    } else {
      setUsers((data ?? []) as AdminUser[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" />;

  const toggleAdmin = async (u: AdminUser) => {
    const grant = !u.roles.includes("admin");
    setPendingId(u.id);
    const { error } = await supabase.rpc("admin_set_role", {
      _target_user_id: u.id,
      _role: "admin",
      _grant: grant,
    });
    setPendingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(grant ? `Promoted ${u.email} to admin` : `Demoted ${u.email}`);
    void load();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">User management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Promote or demote admin access. Only admins can view this page.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border bg-card shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>User</div>
          <div>Roles</div>
          <div className="text-right">Actions</div>
        </div>
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        {!loading && users.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        )}
        {!loading &&
          users.map((u) => {
            const isSelf = u.id === user?.id;
            const isCurrentAdmin = u.roles.includes("admin");
            return (
              <div
                key={u.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Joined {new Date(u.created_at).toLocaleDateString()}
                    {isSelf && " · you"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    u.roles.map((r) => (
                      <Badge
                        key={r}
                        variant={r === "admin" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {r}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={isCurrentAdmin ? "outline" : "default"}
                    disabled={pendingId === u.id}
                    onClick={() => toggleAdmin(u)}
                  >
                    {isCurrentAdmin ? (
                      <>
                        <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Demote
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Promote
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
