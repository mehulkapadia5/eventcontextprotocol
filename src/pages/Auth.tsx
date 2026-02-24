import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });
    // Also check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ variant: "destructive", title: "Google sign-in failed", description: String(error) });
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ variant: "destructive", title: "Login failed", description: error.message });
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast({ variant: "destructive", title: "Signup failed", description: error.message });
    } else {
      toast({
        title: "Check your email",
        description: "We sent you a confirmation link to verify your account.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Activity className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold font-mono">ECP</span>
        </Link>
        <Card>
          <Tabs defaultValue={defaultTab}>
            <CardHeader>
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Log In</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login">
                <CardTitle className="mb-1">Welcome back</CardTitle>
                <CardDescription className="mb-6">Enter your credentials to access your dashboard.</CardDescription>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" required placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                <div className="flex items-center gap-3 my-4">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
                <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                  <GoogleIcon className="h-4 w-4 mr-2" />
                  Continue with Google
                </Button>
              </TabsContent>
              <TabsContent value="signup">
                <CardTitle className="mb-1">Create an account</CardTitle>
                <CardDescription className="mb-6">Start tracking events in minutes.</CardDescription>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email" required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" name="password" type="password" required minLength={6} placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
                <div className="flex items-center gap-3 my-4">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
                <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                  <GoogleIcon className="h-4 w-4 mr-2" />
                  Continue with Google
                </Button>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
