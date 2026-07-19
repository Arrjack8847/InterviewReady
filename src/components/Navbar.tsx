import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";

const PRIMARY_LINKS = [
  { to: "/dashboard", label: "Today" },
  { to: "/start", label: "Practice" },
  { to: "/history", label: "Journal" },
] as const;

export function Navbar() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const identity = user?.displayName || user?.email || "Account";

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate({ to: "/" });
  };

  if (pathname === "/interview") {
    return (
      <header className="app-header app-header--focus">
        <div className="app-header__inner">
          <span className="app-header__wordmark">
            <img
              className="app-header__logo"
              src="/images/interviewready-logo.svg"
              alt="InterviewReady"
            />
          </span>
          <span className="app-header__focus-label">Interview in progress</span>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__wordmark" aria-label="InterviewReady home">
          <img
            className="app-header__logo"
            src="/images/interviewready-logo.svg"
            alt="InterviewReady"
          />
        </Link>

        {user && (
          <nav className="app-header__nav" aria-label="Application navigation">
            {PRIMARY_LINKS.map((link) => (
              <Link key={link.to} to={link.to} data-active={isActive(link.to) || undefined}>
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="app-header__actions">
          {!loading && user ? (
            <>
              <Button asChild size="sm">
                <Link to="/start">Practice</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="app-account-trigger"
                    aria-label={`Account: ${identity}`}
                  >
                    <UserRound aria-hidden="true" />
                    <span className="app-account-trigger__label">Account</span>
                    <span className="app-account-trigger__identity">{identity}</span>
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel className="min-w-0">
                    <span className="block text-xs font-normal text-muted-foreground">
                      Signed in as
                    </span>
                    <span className="mt-1 block truncate" title={user.email || identity}>
                      {user.displayName || user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/resume"
                      search={{ from: "account" }}
                      className="flex-col items-start gap-0.5"
                    >
                      <span>Professional Profile</span>
                      <small className="font-normal text-muted-foreground">
                        Manage résumé, skills, experience and recommendations
                      </small>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleLogout()}>
                    <LogOut aria-hidden="true" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : !loading ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/login" search={{ redirect: "/dashboard" }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register" search={{ redirect: "/dashboard" }}>
                  Create account
                </Link>
              </Button>
            </>
          ) : (
            <span className="app-header__loading" aria-label="Loading account" />
          )}
        </div>

        {user && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="app-header__menu"
                aria-label="Open navigation"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="app-mobile-nav w-[min(92vw,380px)]">
              <SheetTitle className="text-left">InterviewReady</SheetTitle>
              <div className="app-mobile-nav__account">
                <span>Account</span>
                <strong>{user.displayName || user.email}</strong>
                {user.displayName && user.email && <small>{user.email}</small>}
              </div>
              <nav aria-label="Mobile application navigation">
                {PRIMARY_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    data-active={isActive(link.to) || undefined}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/resume"
                  search={{ from: "account" }}
                  data-active={isActive("/resume") || undefined}
                  onClick={() => setOpen(false)}
                >
                  Professional Profile
                </Link>
              </nav>
              <div className="app-mobile-nav__actions">
                <Button variant="outline" size="lg" onClick={handleLogout}>
                  <LogOut aria-hidden="true" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
}
