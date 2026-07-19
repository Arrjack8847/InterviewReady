import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import internalAppCss from "../styles/internal-app.css?url";
import { ErrorState } from "@/components/app/ErrorState";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";

function NotFoundComponent() {
  return (
    <div className="app-container app-container--narrow">
      <div className="app-not-found">
        <p className="app-eyebrow">Error 404</p>
        <h1>That page isn&apos;t part of your preparation path.</h1>
        <p>Check the address or return to a familiar place.</p>
        <div>
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Go home
          </Link>
          <Link
            to="/dashboard"
            className="ml-3 inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-semibold"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <ErrorState
      fullPage
      title="This page didn't load"
      description="Something interrupted the request. Your saved preparation data has not been changed."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center rounded-full border border-input bg-background px-6 text-sm font-semibold"
          >
            Go home
          </a>
        </div>
      }
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "InterviewReady AI — Practice Smarter. Interview Better." },
      {
        name: "description",
        content:
          "AI-powered interview practice for candidates across professions and experience levels. Role-based questions, instant feedback, and progress tracking.",
      },
      { property: "og:title", content: "InterviewReady AI" },
      {
        property: "og:description",
        content: "Practice job interviews with AI feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: internalAppCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const hideNav = pathname === "/" || pathname === "/login" || pathname === "/register";
  const isHomepage = pathname === "/";

  return (
    <div
      className={isHomepage ? "flex min-h-screen flex-col" : "app-root flex min-h-screen flex-col"}
      data-app-route={isHomepage ? undefined : pathname.split("/")[1] || "not-found"}
    >
      {!hideNav && <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </QueryClientProvider>
  );
}
