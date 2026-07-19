import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { getSafeAuthRedirect } from "@/lib/authRedirect";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: getSafeAuthRedirect(search.redirect),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — InterviewReady" },
      {
        name: "description",
        content: "Sign in to continue your personalised interview preparation.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { redirect = "/" } = Route.useSearch();
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.history.replace(redirect);
  }, [authLoading, user, redirect, router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (loginError) {
      console.error("Login failed:", loginError);
      setError("Invalid email or password. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-page__story" aria-label="InterviewReady preparation approach">
        <Link to="/" className="auth-wordmark">
          InterviewReady
        </Link>
        <div className="auth-page__story-copy">
          <p>Personal preparation workspace</p>
          <h2>Continue where your preparation left off.</h2>
          <p>
            Your résumé, practice history and feedback stay connected so every session can build on
            the last.
          </p>
          <ol className="auth-journey">
            <li>
              <span>01</span>Résumé understanding
            </li>
            <li>
              <span>02</span>Personalised practice
            </li>
            <li>
              <span>03</span>Actionable feedback
            </li>
            <li>
              <span>04</span>Visible improvement
            </li>
          </ol>
        </div>
        <p className="auth-page__privacy">Your preparation data stays connected to your account.</p>
      </aside>

      <main className="auth-page__form-wrap">
        <div className="auth-form">
          <Link to="/" className="auth-form__back">
            ← Back to InterviewReady
          </Link>
          <h1>Welcome back.</h1>
          <p className="auth-form__intro">
            Sign in to continue your interview preparation and review your progress.
          </p>
          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin}>
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
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
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
            </div>
            <Button type="submit" size="lg" disabled={loading || authLoading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="auth-form__switch">
            Don&apos;t have an account?{" "}
            <Link to="/register" search={{ redirect }}>
              Create your workspace
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
