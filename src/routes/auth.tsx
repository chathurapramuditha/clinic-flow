import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — PhysioSchedule" },
      { name: "description", content: "Sign in with your employee number." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();

  const [emp, setEmp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(emp.trim(), password);
    setBusy(false);
    if (error) {
      // Ensure error is a readable string. JSON.stringify(Error) returns "{}"
      let msg = typeof error === "string" ? error : JSON.stringify(error);
      if (typeof error !== "string" && error && typeof error === "object" && "message" in error) {
        msg = (error as { message: string }).message;
      }
      setError(msg);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen w-full bg-gradient-to-br from-teal-50 via-white to-sky-50 lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-10 lg:flex">
        <Link to="/auth" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow-md">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">PhysioSchedule</div>
            <div className="text-xs text-muted-foreground">Physiotherapy Department</div>
          </div>
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Staff-only scheduling workspace.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your employee number. New accounts are created by an administrator.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Therapists see their own column. Admins manage staff and see everything.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-white">
                <Activity className="h-5 w-5" />
              </div>
              <div className="text-base font-bold">PhysioSchedule</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your employee number and password.
          </p>

          <form onSubmit={handleSignIn} className="mt-6 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="emp">Employee number</Label>
              <Input
                id="emp"
                autoComplete="username"
                inputMode="text"
                autoCapitalize="characters"
                placeholder="e.g. 26754"
                value={emp}
                onChange={(e) => setEmp(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="mt-1 bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:opacity-95"
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need an account? Ask an administrator to add you.
          </p>
        </div>
      </div>
    </div>
  );
}
