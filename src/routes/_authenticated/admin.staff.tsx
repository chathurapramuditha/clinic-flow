import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2, UserPlus, Pencil } from "lucide-react";
import type { AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({ meta: [{ title: "Staff — PhysioSchedule" }] }),
  component: AdminStaffPage,
});

type StaffRow = {
  user_id: string;
  emp_number: string;
  name: string;
  roles: AppRole[];
  created_at: string;
};

function AdminStaffPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [emp, setEmp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffRow | null>(null);
  const [editTarget, setEditTarget] = useState<StaffRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmp, setEditEmp] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_staff");
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as StaffRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" />;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_staff", {
      _emp: emp.trim(),
      _name: name.trim(),
      _password: password,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${name} (${emp})`);
    setAddOpen(false);
    setEmp("");
    setName("");
    setPassword("");
    void load();
  };

  const openEdit = (r: StaffRow) => {
    setEditTarget(r);
    setEditName(r.name);
    setEditEmp(r.emp_number);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditBusy(true);
    const { error } = await supabase.rpc("admin_update_staff", {
      _target_user_id: editTarget.user_id,
      _emp: editEmp.trim(),
      _name: editName.trim(),
    });
    setEditBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated ${editName.trim()} (${editEmp.trim()})`);
    setEditTarget(null);
    void load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    const { error } = await supabase.rpc("admin_delete_staff", {
      _target_user_id: target.user_id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Removed ${target.name}`);
    void load();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add or remove staff accounts. Users sign in with their employee number.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:opacity-95">
              <UserPlus className="mr-1.5 h-4 w-4" /> Add staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add staff member</DialogTitle>
              <DialogDescription>
                Creates a therapist account. Share the employee number and password with them.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="add-name">Full name</Label>
                <Input
                  id="add-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="add-emp">Employee number</Label>
                <Input
                  id="add-emp"
                  value={emp}
                  onChange={(e) => setEmp(e.target.value)}
                  autoCapitalize="characters"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="add-password">Password</Label>
                <Input
                  id="add-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <p className="text-[11px] text-muted-foreground">At least 6 characters.</p>
              </div>
              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Adding…" : "Add staff"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 rounded-2xl border bg-card shadow-sm">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>Emp #</div>
          <div>Name</div>
          <div>Roles</div>
          <div className="text-right">Actions</div>
        </div>
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No staff yet.
          </div>
        )}
        {!loading &&
          rows.map((r) => {
            const isSelf = r.user_id === user?.id;
            return (
              <div
                key={r.user_id}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <div className="font-mono text-sm">{r.emp_number}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.name}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Added {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    r.roles.map((role) => (
                      <Badge
                        key={role}
                        variant={role === "admin" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {role}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`edit-staff-${r.emp_number}`}
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSelf}
                    data-testid={`remove-staff-${r.emp_number}`}
                    onClick={() => setConfirmDelete(r)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent data-testid="edit-staff-dialog">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
            <DialogDescription>
              Update the name or employee number. They will sign in with the new
              employee number afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Full name</Label>
              <Input
                id="edit-name"
                data-testid="edit-staff-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-emp">Employee number</Label>
              <Input
                id="edit-emp"
                data-testid="edit-staff-emp-input"
                value={editEmp}
                onChange={(e) => setEditEmp(e.target.value)}
                autoCapitalize="characters"
                required
              />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editBusy} data-testid="edit-staff-save-button">
                {editBusy ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} ({confirmDelete?.emp_number}) will lose access
              immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
