import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/app/LoadingState";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      void navigate({
        to: "/login",
        search: {
          redirect,
        },
        replace: true,
      });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <LoadingState
        fullPage
        title="Checking your account"
        description="Preparing your personal workspace."
      />
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
