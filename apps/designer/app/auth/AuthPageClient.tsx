"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import AuthShell from "@/components/auth/AuthShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseClientWithAuth } from "@/hooks/useSupabaseClientWithAuth";
import { cn } from "@/lib/utils";

export default function AuthPageClient() {
  const searchParams = useSearchParams();
  const wantsSignup = searchParams.get("signup") === "true";
  const plan = searchParams.get("plan");
  const errorCode = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLogin, setIsLogin] = useState(!wantsSignup);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const supabase = useSupabaseClientWithAuth();
  const { isLoading, session } = useAuth();
  const shownInitialErrorRef = useRef(false);

  useEffect(() => {
    setIsLogin(!wantsSignup);
  }, [wantsSignup]);

  const errorMessage = useMemo(() => {
    if (!errorCode) return null;
    switch (errorCode) {
      case "AuthApiError":
        return "That link is expired or invalid. Please try signing in again.";
      case "500":
        return "Something went wrong signing you in. Please try again.";
      default:
        return "Sign-in failed. Please try again.";
    }
  }, [errorCode]);

  // Handle redirect if user is already authenticated
  useEffect(() => {
    if (session && !isLoading) {
      try {
        router.replace("/accounts");
        setTimeout(() => {
          if (window.location.pathname === "/auth") {
            window.location.href = "/accounts";
          }
        }, 1000);
      } catch {
        window.location.href = "/accounts";
      }
    }
  }, [session, isLoading, router]);

  useEffect(() => {
    if (!errorMessage || shownInitialErrorRef.current) return;
    shownInitialErrorRef.current = true;
    toast({
      description: errorMessage,
      title: "Authentication error",
      variant: "destructive",
    });
  }, [errorMessage, toast]);

  // Show a single, blocking loading state during any auth activity or redirect
  if (loading || isLoading || !supabase || (session && !isLoading)) {
    return (
      <AuthShell title="Loading" description="Just a second…" backHref="/" backLabel="Back">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        toast({
          description: "Successfully signed in.",
          title: "Welcome back!",
        });
        router.replace("/accounts");
        return;
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      toast({
        description: "We've sent you a confirmation link.",
        title: "Check your email",
      });
      setLoading(false);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : "An error occurred",
        title: "Error",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={isLogin ? "Sign in" : "Create account"}
      description={
        plan
          ? `Continue to choose the ${plan} plan after you create an account.`
          : isLogin
            ? "Use your email and password."
            : "Use an email you can access."
      }
      backHref="/"
      backLabel="Back"
      footer={
        <Link href="/partners" className="hover:text-foreground transition-colors">
          Partnerships
        </Link>
      }
    >
      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn’t sign you in</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-5 grid grid-cols-2 rounded-lg border border-border/60 bg-muted/30 p-1">
        <button
          type="button"
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
            isLogin ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setIsLogin(true)}
          disabled={loading}
        >
          Sign in
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
            !isLogin ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setIsLogin(false)}
          disabled={loading}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            placeholder="name@example.com"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={loading || !supabase || isLoading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            placeholder="••••••••"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            disabled={loading || !supabase || isLoading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {!isLogin ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
              disabled={loading || !supabase || isLoading}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        ) : null}

        {isLogin ? (
          <div className="-mt-1 text-right">
            <Link
              href="/auth/reset-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        ) : null}

        <Button className="w-full" type="submit" disabled={loading || !supabase || isLoading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}

