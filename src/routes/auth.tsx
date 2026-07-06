import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PhysioSchedule" },
      { name: "description", content: "Sign in or create a patient account for PhysioSchedule." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinError, setSigninError] = useState<string | null>(null);

  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigninError(null);
    setSigninBusy(true);
    const { error } = await signIn(signinEmail.trim(), signinPassword);
    setSigninBusy(false);
    if (error) {
      setSigninError(error);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/" });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    if (signupPassword.length < 8) {
      setSignupError("Password must be at least 8 characters.");
      return;
    }
    setSignupBusy(true);
    const { error } = await signUp(signupEmail.trim(), signupPassword, {
      name: signupName.trim(),
    });
    setSignupBusy(false);
    if (error) {
      setSignupError(error);
      return;
    }
    toast.success("Account created", {
      description: "You're signed in as a patient.",
    });
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
            Modern scheduling for your physio team.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            45-minute appointment slots, live realtime updates, and clean patient records — all
            in one place.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Patients see only their own appointments. Therapists see their column. Admins see
          everything.
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
          <h1 className="text-2xl font-bold tracking-tight">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your account or create a patient profile.
          </p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    autoComplete="email"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="si-password">Password</Label>
                  <Input
                    id="si-password"
                    type="password"
                    autoComplete="current-password"
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    required
                  />
                </div>
                {signinError && <p className="text-xs text-destructive">{signinError}</p>}
                <Button
                  type="submit"
                  disabled={signinBusy}
                  className="mt-1 bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:opacity-95"
                >
                  {signinBusy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input
                    id="su-name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    type="password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
                </div>
                {signupError && <p className="text-xs text-destructive">{signupError}</p>}
                <Button
                  type="submit"
                  disabled={signupBusy}
                  className="mt-1 bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:opacity-95"
                >
                  {signupBusy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
