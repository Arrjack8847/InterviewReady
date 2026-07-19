import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { getSafeAuthRedirect } from "@/lib/authRedirect";

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: getSafeAuthRedirect(search.redirect),
  }),
  head: () => ({
    meta: [
      { title: "Create account — InterviewReady" },
      {
        name: "description",
        content: "Create your personal InterviewReady preparation workspace.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const router = useRouter();
  const { redirect = "/" } = Route.useSearch();
  const { user, loading: authLoading, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.history.replace(redirect);
  }, [authLoading, user, redirect, router]);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName) return setError("Please enter your full name.");
    if (!cleanEmail) return setError("Please enter your email address.");
    if (password.length < 6) return setError("Password must contain at least 6 characters.");
    setError("");
    setLoading(true);
    try {
      await register(cleanName, cleanEmail, password);
    } catch (registerError) {
      console.error("Register page error:", registerError);
      const message = registerError instanceof Error ? registerError.message : "";
      const normalized = message.toLowerCase();
      if (normalized.includes("check your email") || normalized.includes("confirm your account"))
        setError(
          "Your account was created. Check your email to confirm your account, then log in.",
        );
      else if (normalized.includes("already registered") || normalized.includes("already exists"))
        setError("This email is already registered. Try signing in instead.");
      else if (normalized.includes("password") || normalized.includes("weak"))
        setError("Password is too weak. Use at least 6 characters.");
      else if (normalized.includes("invalid email"))
        setError("Please enter a valid email address.");
      else if (normalized.includes("supabase is not configured"))
        setError("The account service is not configured. Please contact support.");
      else if (normalized.includes("failed to fetch") || normalized.includes("network"))
        setError("Unable to connect to the account service. Check your connection and try again.");
      else setError(message || "Failed to create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-page__story" aria-label="InterviewReady account benefits">
        <Link to="/" className="auth-wordmark">
          InterviewReady
        </Link>
        <div className="auth-page__story-copy">
          <p>Your personal workspace</p>
          <h2>Preparation shaped around your experience.</h2>
          <p>
            Create one place for your résumé insights, realistic practice, detailed feedback and
            visible progress.
          </p>
          <ol className="auth-journey">
            <li>
              <span>01</span>Build your career profile
            </li>
            <li>
              <span>02</span>Choose your target
            </li>
            <li>
              <span>03</span>Practise in your preferred mode
            </li>
            <li>
              <span>04</span>Improve with evidence
            </li>
          </ol>
        </div>
        <p className="auth-page__privacy">
          We use your data only to support your preparation experience.
        </p>
      </aside>
      <main className="auth-page__form-wrap">
        <div className="auth-form">
          <Link to="/" className="auth-form__back">
            ← Back to InterviewReady
          </Link>
          <h1>Create your preparation workspace.</h1>
          <p className="auth-form__intro">
            Set up your account to save your résumé profile, sessions and recommendations.
          </p>
          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleRegister}>
            <div className="app-form-group">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                placeholder="Your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="app-form-group">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="app-form-group">
              <Label htmlFor="password">Password</Label>
              <div className="auth-form__password">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <>
                      <EyeOff aria-hidden="true" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye aria-hidden="true" /> Show
                    </>
                  )}
                </button>
              </div>
              <p className="app-form-help">
                Use at least six characters. A longer, unique password is safer.
              </p>
            </div>
            <Button type="submit" size="lg" disabled={loading || authLoading}>
              {loading ? "Creating workspace…" : "Create account"}
            </Button>
          </form>
          <p className="auth-form__switch">
            Already have an account?{" "}
            <Link to="/login" search={{ redirect }}>
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
