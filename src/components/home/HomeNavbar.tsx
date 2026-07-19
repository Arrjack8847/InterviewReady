import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { homeNavigation } from "@/data/homepageContent";

type NavTheme = "light" | "dark";

const NAV_HEIGHT = 72;

export function HomeNavbar() {
  const { user, loading } = useAuth();

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroFinished, setHeroFinished] = useState(false);
  const [sectionTheme, setSectionTheme] = useState<NavTheme>("light");

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Detect whether the cinematic hero has finished.
   * The navbar remains visible at all times.
   */
  useEffect(() => {
    const updateNavbarState = () => {
      setScrolled(window.scrollY > 18);

      const hero = document.querySelector<HTMLElement>(".home-hero");

      if (!hero) {
        setHeroFinished(true);
        return;
      }

      const heroBounds = hero.getBoundingClientRect();

      /*
       * The hero is considered finished when its bottom
       * reaches the navbar sampling line.
       */
      setHeroFinished(heroBounds.bottom <= NAV_HEIGHT);
    };

    updateNavbarState();

    window.addEventListener("scroll", updateNavbarState, {
      passive: true,
    });

    window.addEventListener("resize", updateNavbarState);

    return () => {
      window.removeEventListener("scroll", updateNavbarState);

      window.removeEventListener("resize", updateNavbarState);
    };
  }, []);

  /*
   * Detect section colour only after the hero has finished.
   * During the entire hero, the navbar always stays light-themed.
   */
  useEffect(() => {
    if (!heroFinished) {
      setSectionTheme("light");
      return;
    }

    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-theme]"));

    if (sections.length === 0) {
      return;
    }

    const updateTheme = () => {
      const samplePoint = NAV_HEIGHT + 2;

      const activeSection = sections.find((section) => {
        const bounds = section.getBoundingClientRect();

        return bounds.top <= samplePoint && bounds.bottom > samplePoint;
      });

      if (!activeSection) {
        return;
      }

      const nextTheme: NavTheme = activeSection.dataset.navTheme === "dark" ? "dark" : "light";

      setSectionTheme(nextTheme);
    };

    updateTheme();

    window.addEventListener("scroll", updateTheme, {
      passive: true,
    });

    window.addEventListener("resize", updateTheme);

    return () => {
      window.removeEventListener("scroll", updateTheme);
      window.removeEventListener("resize", updateTheme);
    };
  }, [heroFinished]);

  /*
   * Mobile-menu focus management.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const firstLink = panelRef.current?.querySelector<HTMLElement>("a, button");

    firstLink?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();

        setOpen(false);
        menuButtonRef.current?.focus();

        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = [
        menuButtonRef.current,
        ...Array.from(panelRef.current.querySelectorAll<HTMLElement>("a, button:not([disabled])")),
      ].filter((element): element is HTMLElement => Boolean(element));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
  };

  const practiceLabel = user ? "Continue practising" : "Start practising";

  /*
   * During the hero:
   * - force the light navbar style
   * - keep the transparent cinematic background
   *
   * After the hero:
   * - use each section's data-nav-theme
   * - use the blurred navbar background
   */
  const activeTheme: NavTheme = heroFinished ? sectionTheme : "light";

  const navClasses = [
    "home-nav",
    `home-nav--${activeTheme}`,
    !heroFinished ? "home-nav--hero" : "",
    heroFinished && scrolled ? "home-nav--scrolled" : "",
    open ? "home-nav--menu-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={navClasses}>
      <div className="home-shell home-nav__inner">
        <a
          href="#top"
          className="home-brand"
          aria-label="InterviewReady, back to top"
          onClick={closeMenu}
        >
          <img
            className="home-brand__logo"
            src="/images/interviewready-logo.svg"
            alt="InterviewReady"
          />
        </a>

        <nav className="home-nav__links" aria-label="Homepage sections">
          {homeNavigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="home-nav__actions">
          {!loading && !user && (
            <Link to="/login" className="home-link-button">
              Sign in
            </Link>
          )}

          <Link to="/start" className="home-button home-button--small home-nav__cta">
            {practiceLabel}
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="home-nav__menu-button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="home-mobile-navigation"
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div
          ref={panelRef}
          id="home-mobile-navigation"
          className="home-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Homepage navigation"
        >
          <nav aria-label="Homepage sections">
            {homeNavigation.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="home-mobile-nav__actions">
            {!loading && !user && (
              <Link to="/login" onClick={closeMenu}>
                Sign in
              </Link>
            )}

            <Link to="/start" className="home-button home-button--dark" onClick={closeMenu}>
              {practiceLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
