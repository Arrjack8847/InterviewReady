import {
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/context/AuthContext";

const HERO_VIDEO_PATH =
  "/videos/interviewready-hero.mp4";

const HERO_POSTER_PATH =
  "/images/interviewready-hero-poster.webp";

const FALLBACK_VIDEO_DURATION = 9;

/**
 * The video plays normally from 0.0s to 0.5s.
 * After that, scrolling controls the remaining video.
 */
const INTRO_PLAY_DURATION_SECONDS = 0.8;

const VIDEO_END_OFFSET_SECONDS = 0.04;

const HERO_STAGES = [
  {
    title: "Every interview",
    emphasis: "starts here.",
  },
  {
    title: "Understanding,",
    emphasis: "not just scanning.",
  },
  {
    title: "Questions built",
    emphasis: "around you.",
  },
  {
    title: "Practise",
    emphasis: "before it matters.",
  },
  {
    title: "Know exactly",
    emphasis: "what to improve.",
  },
  {
    title: "Walk into it",
    emphasis: "ready.",
  },
] as const;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function getStageIndex(progress: number) {
  if (progress < 0.16) {
    return 0;
  }

  if (progress < 0.34) {
    return 1;
  }

  if (progress < 0.52) {
    return 2;
  }

  if (progress < 0.7) {
    return 3;
  }

  if (progress < 0.88) {
    return 4;
  }

  return 5;
}

export function HomeHero() {
  const { user, loading } = useAuth();

  const heroRef =
    useRef<HTMLElement | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const targetTimeRef = useRef(
    INTRO_PLAY_DURATION_SECONDS,
  );

  const durationRef = useRef(
    FALLBACK_VIDEO_DURATION,
  );

  const animationFrameRef =
    useRef<number | null>(null);

  /**
   * True only after the opening 0.5-second animation
   * has completed and scroll scrubbing may begin.
   */
  const scrollScrubbingEnabledRef =
    useRef(false);

  /**
   * Indicates that desktop scroll mode is currently active.
   */
  const desktopScrollModeRef =
    useRef(false);

  /**
   * Prevents the opening animation from replaying repeatedly.
   */
  const desktopIntroCompletedRef =
    useRef(false);

  /**
   * Tracks whether the opening 0.5 seconds are playing.
   */
  const desktopIntroPlayingRef =
    useRef(false);

  const mobilePlaybackStartedRef =
    useRef(false);

  const activeStageRef = useRef(0);

  const [activeStage, setActiveStage] =
    useState(0);

  const [scrollProgress, setScrollProgress] =
    useState(0);

  const authenticated =
    !loading && Boolean(user);

  const finalStage =
    activeStage === HERO_STAGES.length - 1;

  const currentStage =
    HERO_STAGES[activeStage];

  useEffect(() => {
    if (
      !heroRef.current ||
      !videoRef.current
    ) {
      return;
    }

    const hero = heroRef.current;
    const video = videoRef.current;

    const desktopQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 901px)",
    );

    const reducedMotionQuery =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );

    function getMaximumVideoTime() {
      return Math.max(
        durationRef.current -
          VIDEO_END_OFFSET_SECONDS,
        0,
      );
    }

    function getIntroEndTime() {
      return Math.min(
        INTRO_PLAY_DURATION_SECONDS,
        getMaximumVideoTime(),
      );
    }

    function updateStage(progress: number) {
      const nextStage =
        getStageIndex(progress);

      if (
        nextStage === activeStageRef.current
      ) {
        return;
      }

      activeStageRef.current = nextStage;
      setActiveStage(nextStage);
    }

    function calculateScrollProgress() {
      const bounds =
        hero.getBoundingClientRect();

      const scrollDistance = Math.max(
        hero.offsetHeight -
          window.innerHeight,
        1,
      );

      const travelledDistance = clamp(
        -bounds.top,
        0,
        scrollDistance,
      );

      return (
        travelledDistance /
        scrollDistance
      );
    }

    function updateScrollTarget() {
      if (
        !scrollScrubbingEnabledRef.current
      ) {
        return;
      }

      const progress =
        calculateScrollProgress();

      const introEndTime =
        getIntroEndTime();

      const maximumVideoTime =
        getMaximumVideoTime();

      const scrollControlledDuration =
        Math.max(
          maximumVideoTime -
            introEndTime,
          0,
        );

      /**
       * At the top of the hero:
       * currentTime = 0.5 seconds.
       *
       * At the bottom of the hero:
       * currentTime = end of video.
       */
      targetTimeRef.current =
        introEndTime +
        progress *
          scrollControlledDuration;

      hero.style.setProperty(
        "--hero-scroll-progress",
        progress.toFixed(4),
      );

      setScrollProgress(progress);
      updateStage(progress);
    }

    function finishDesktopIntro() {
      if (
        desktopIntroCompletedRef.current
      ) {
        return;
      }

      desktopIntroPlayingRef.current =
        false;

      desktopIntroCompletedRef.current =
        true;

      video.pause();

      const introEndTime =
        getIntroEndTime();

      if (
        Number.isFinite(introEndTime)
      ) {
        video.currentTime =
          introEndTime;
      }

      if (
        desktopScrollModeRef.current &&
        !reducedMotionQuery.matches
      ) {
        scrollScrubbingEnabledRef.current =
          true;

        hero.dataset.heroIntro =
          "complete";

        updateScrollTarget();
      }
    }

    function startDesktopIntro() {
      if (
        !desktopScrollModeRef.current ||
        reducedMotionQuery.matches ||
        desktopIntroCompletedRef.current ||
        desktopIntroPlayingRef.current
      ) {
        return;
      }

      if (
        video.readyState <
        HTMLMediaElement.HAVE_METADATA
      ) {
        return;
      }

      scrollScrubbingEnabledRef.current =
        false;

      mobilePlaybackStartedRef.current =
        false;

      desktopIntroPlayingRef.current =
        true;

      targetTimeRef.current =
        getIntroEndTime();

      hero.dataset.heroMode = "scroll";
      hero.dataset.heroIntro = "playing";

      activeStageRef.current = 0;

      setActiveStage(0);
      setScrollProgress(0);

      hero.style.setProperty(
        "--hero-scroll-progress",
        "0",
      );

      video.pause();
      video.playbackRate = 1;
      video.currentTime = 0;

      void video.play().catch(() => {
        /**
         * Muted autoplay is normally allowed.
         * If the browser still blocks it, skip directly
         * to 0.5s and enable scroll control.
         */
        finishDesktopIntro();
      });
    }

    function startMobilePlayback() {
      if (
        desktopScrollModeRef.current ||
        reducedMotionQuery.matches ||
        mobilePlaybackStartedRef.current
      ) {
        return;
      }

      if (
        video.readyState <
        HTMLMediaElement.HAVE_METADATA
      ) {
        return;
      }

      mobilePlaybackStartedRef.current =
        true;

      scrollScrubbingEnabledRef.current =
        false;

      video.pause();
      video.currentTime = 0;
      video.playbackRate = 0.8;

      void video.play().catch(() => {
        mobilePlaybackStartedRef.current =
          false;
      });
    }

    function showStaticPoster() {
      desktopScrollModeRef.current =
        false;

      scrollScrubbingEnabledRef.current =
        false;

      desktopIntroPlayingRef.current =
        false;

      mobilePlaybackStartedRef.current =
        false;

      targetTimeRef.current = 0;

      video.pause();

      if (
        video.readyState >=
        HTMLMediaElement.HAVE_METADATA
      ) {
        video.currentTime = 0;
      }

      hero.dataset.heroMode = "static";
      hero.dataset.heroIntro = "static";

      hero.style.setProperty(
        "--hero-scroll-progress",
        "0",
      );

      activeStageRef.current = 0;

      setActiveStage(0);
      setScrollProgress(0);
    }

    function enableDesktopScrollMode() {
      desktopScrollModeRef.current =
        true;

      mobilePlaybackStartedRef.current =
        false;

      hero.dataset.heroMode = "scroll";

      video.pause();

      if (
        desktopIntroCompletedRef.current
      ) {
        scrollScrubbingEnabledRef.current =
          true;

        hero.dataset.heroIntro =
          "complete";

        updateScrollTarget();
        return;
      }

      startDesktopIntro();
    }

    function updateHeroMode() {
      const desktopScrollEnabled =
        desktopQuery.matches &&
        !reducedMotionQuery.matches;

      if (desktopScrollEnabled) {
        enableDesktopScrollMode();
        return;
      }

      desktopScrollModeRef.current =
        false;

      scrollScrubbingEnabledRef.current =
        false;

      desktopIntroPlayingRef.current =
        false;

      if (reducedMotionQuery.matches) {
        showStaticPoster();
        return;
      }

      hero.dataset.heroMode =
        "autoplay";

      hero.dataset.heroIntro =
        "mobile";

      startMobilePlayback();
    }

    function handleLoadedMetadata() {
      const videoDuration =
        video.duration;

      durationRef.current =
        Number.isFinite(videoDuration) &&
        videoDuration > 0
          ? videoDuration
          : FALLBACK_VIDEO_DURATION;

      video.pause();

      if (
        reducedMotionQuery.matches
      ) {
        showStaticPoster();
        return;
      }

      if (
        desktopScrollModeRef.current
      ) {
        if (
          desktopIntroCompletedRef.current
        ) {
          video.currentTime =
            getIntroEndTime();

          scrollScrubbingEnabledRef.current =
            true;

          updateScrollTarget();
        } else {
          startDesktopIntro();
        }

        return;
      }

      startMobilePlayback();
    }

    function handleCanPlay() {
      if (
        desktopScrollModeRef.current &&
        !desktopIntroCompletedRef.current
      ) {
        startDesktopIntro();
        return;
      }

      if (
        !desktopScrollModeRef.current &&
        !reducedMotionQuery.matches
      ) {
        startMobilePlayback();
      }
    }

    function handleTimeUpdate() {
      if (
        desktopIntroPlayingRef.current
      ) {
        if (
          video.currentTime >=
          getIntroEndTime() - 0.015
        ) {
          finishDesktopIntro();
        }

        return;
      }

      if (
        scrollScrubbingEnabledRef.current
      ) {
        return;
      }

      if (
        desktopScrollModeRef.current
      ) {
        return;
      }

      const duration =
        durationRef.current ||
        FALLBACK_VIDEO_DURATION;

      const progress = clamp(
        video.currentTime / duration,
        0,
        1,
      );

      setScrollProgress(progress);
      updateStage(progress);
    }

    function handleVideoEnded() {
      if (
        desktopIntroPlayingRef.current
      ) {
        finishDesktopIntro();
        return;
      }

      if (
        scrollScrubbingEnabledRef.current
      ) {
        return;
      }

      video.pause();

      const finalTime =
        getMaximumVideoTime();

      if (
        Number.isFinite(finalTime)
      ) {
        video.currentTime =
          finalTime;
      }

      activeStageRef.current =
        HERO_STAGES.length - 1;

      setActiveStage(
        HERO_STAGES.length - 1,
      );

      setScrollProgress(1);
    }

    function animateVideo() {
      /**
       * Extra check to stop the intro accurately near 0.5s.
       * This is smoother than relying only on timeupdate,
       * which may fire less frequently.
       */
      if (
        desktopIntroPlayingRef.current &&
        video.currentTime >=
          getIntroEndTime() - 0.01
      ) {
        finishDesktopIntro();
      }

      if (
        scrollScrubbingEnabledRef.current &&
        video.readyState >=
          HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        const currentTime =
          video.currentTime;

        const targetTime =
          targetTimeRef.current;

        const difference =
          targetTime - currentTime;

        if (
          !video.seeking &&
          Math.abs(difference) > 0.01
        ) {
          const smoothingStrength =
            Math.abs(difference) > 1.5
              ? 0.2
              : 0.12;

          const nextTime = clamp(
            currentTime +
              difference *
                smoothingStrength,
            getIntroEndTime(),
            getMaximumVideoTime(),
          );

          video.currentTime = nextTime;
        }
      }

      animationFrameRef.current =
        window.requestAnimationFrame(
          animateVideo,
        );
    }

    updateHeroMode();

    if (
      video.readyState >=
      HTMLMediaElement.HAVE_METADATA
    ) {
      handleLoadedMetadata();
    }

    window.addEventListener(
      "scroll",
      updateScrollTarget,
      {
        passive: true,
      },
    );

    window.addEventListener(
      "resize",
      updateHeroMode,
    );

    video.addEventListener(
      "loadedmetadata",
      handleLoadedMetadata,
    );

    video.addEventListener(
      "canplay",
      handleCanPlay,
    );

    video.addEventListener(
      "timeupdate",
      handleTimeUpdate,
    );

    video.addEventListener(
      "ended",
      handleVideoEnded,
    );

    desktopQuery.addEventListener(
      "change",
      updateHeroMode,
    );

    reducedMotionQuery.addEventListener(
      "change",
      updateHeroMode,
    );

    animationFrameRef.current =
      window.requestAnimationFrame(
        animateVideo,
      );

    return () => {
      window.removeEventListener(
        "scroll",
        updateScrollTarget,
      );

      window.removeEventListener(
        "resize",
        updateHeroMode,
      );

      video.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata,
      );

      video.removeEventListener(
        "canplay",
        handleCanPlay,
      );

      video.removeEventListener(
        "timeupdate",
        handleTimeUpdate,
      );

      video.removeEventListener(
        "ended",
        handleVideoEnded,
      );

      desktopQuery.removeEventListener(
        "change",
        updateHeroMode,
      );

      reducedMotionQuery.removeEventListener(
        "change",
        updateHeroMode,
      );

      if (
        animationFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(
          animationFrameRef.current,
        );
      }

      video.pause();
    };
  }, []);

  return (
    <section
      ref={heroRef}
      id="top"
      className="home-hero home-hero--cinematic"
      aria-labelledby="home-hero-title"
    >
      <h1
        id="home-hero-title"
        className="sr-only"
      >
        Personalised AI interview preparation
      </h1>

      <div className="home-hero__sticky">
        <div
          className="home-hero__background"
          aria-hidden="true"
        >
          <video
            ref={videoRef}
            className="home-hero__video"
            poster={HERO_POSTER_PATH}
            preload="auto"
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            tabIndex={-1}
          >
            <source
              src={HERO_VIDEO_PATH}
              type="video/mp4"
            />
          </video>
        </div>

        <div
          className="home-hero__cinematic-shade"
          aria-hidden="true"
        />

        <div className="home-hero__minimal-content">
          <div
            className={[
              "home-hero__caption",
              finalStage
                ? "home-hero__caption--final"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p
              key={activeStage}
              className="home-hero__caption-text"
            >
              <span>
                {currentStage.title}
              </span>

              <strong>
                {currentStage.emphasis}
              </strong>
            </p>

            {finalStage && (
              <div className="home-hero__final-actions">
                <Link
                  to="/start"
                  className="home-button home-button--dark"
                >
                  {authenticated
                    ? "Continue practising"
                    : "Start practising"}

                  <ArrowRight
                    size={17}
                    aria-hidden="true"
                  />
                </Link>

                <Link
                  to="/resume"
                  className="home-hero__resume-link"
                >
                  {authenticated
                    ? "View career profile"
                    : "Analyse my résumé"}

                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            )}
          </div>

          <div
            className="home-hero__progress"
            aria-hidden="true"
          >
            <div className="home-hero__progress-meta">
              <span>
                {String(
                  activeStage + 1,
                ).padStart(2, "0")}
              </span>

              <i />

              <span>
                {String(
                  HERO_STAGES.length,
                ).padStart(2, "0")}
              </span>
            </div>

            <div className="home-hero__progress-track">
              <span
                style={{
                  transform: `scaleX(${scrollProgress})`,
                }}
              />
            </div>
          </div>
        </div>

        {scrollProgress < 0.08 && (
          <div
            className="home-hero__scroll-hint"
            aria-hidden="true"
          >
            <span>Scroll to begin</span>
            <i />
          </div>
        )}
      </div>
    </section>
  );
}