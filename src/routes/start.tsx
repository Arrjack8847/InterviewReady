import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FileText, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { InterviewSetupForm } from "@/components/InterviewSetupForm";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import {
  createPracticeDraft,
  PRACTICE_DRAFT_KEY,
  readPracticeDraft,
  savePracticeDraft,
  type PracticeDraft,
  type PracticePath,
} from "@/lib/practiceDraft";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Practice — InterviewReady" },
      {
        name: "description",
        content: "Plan a personalised or quick interview practice session.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <StartPage />
    </RequireAuth>
  ),
});

type StoredProfile = {
  fileName?: string;
  uploadedAt?: string;
  summary?: string;
  skills?: string[];
  projects?: string[];
  recommendedRoles?: string[];
};

function readStoredProfile() {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("ir.resume");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as StoredProfile;
  } catch {
    return null;
  }
}

function StartPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PracticeDraft | null>(null);
  const [profile, setProfile] = useState<StoredProfile | null>(null);

  useEffect(() => {
    setDraft(readPracticeDraft());
    setProfile(readStoredProfile());
  }, []);

  const choosePath = (path: PracticePath) => {
    if (path === "personalized" && !profile) {
      setDraft(savePracticeDraft({ path, stage: "profile" }));
      navigate({ to: "/resume", search: { from: "practice" } });
      return;
    }

    setDraft(
      savePracticeDraft({
        path,
        stage: path === "personalized" ? "profile" : "setup",
      }),
    );
  };

  const continueWithProfile = () => {
    setDraft(savePracticeDraft({ path: "personalized", stage: "setup" }));
  };

  const returnToChoices = () => {
    const next = createPracticeDraft({ ...readPracticeDraft(), path: undefined, stage: "choice" });
    localStorage.setItem(PRACTICE_DRAFT_KEY, JSON.stringify(next));
    setDraft(next);
  };

  if (!draft) {
    return (
      <div className="app-state app-state--full" role="status">
        Preparing Practice…
      </div>
    );
  }

  const showChoices = draft.stage === "choice" || !draft.path;
  const showProfileSummary =
    draft.path === "personalized" && draft.stage === "profile" && Boolean(profile);
  const showMissingProfile = draft.path === "personalized" && draft.stage === "profile" && !profile;
  const showSetup = draft.stage === "setup" && Boolean(draft.path);

  return (
    <div className="app-container app-container--narrow practice-page">
      <Button asChild variant="ghost" className="mb-5">
        <Link to="/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>

      <PageHeader
        eyebrow="Practice"
        title="Plan a practice session"
        description="Choose how you want to prepare, then shape the session around the interview ahead."
      />

      {showChoices && (
        <section className="practice-choice-section" aria-labelledby="practice-choice-title">
          <div className="app-section-heading">
            <div>
              <h2 id="practice-choice-title">How would you like to prepare?</h2>
              <p>Both paths use the same interview and feedback system.</p>
            </div>
          </div>
          <div className="practice-choice-grid">
            <button
              type="button"
              className="practice-choice"
              onClick={() => choosePath("personalized")}
            >
              <span className="status-pill">Recommended</span>
              <FileText aria-hidden="true" />
              <h3>Personalised Practice</h3>
              <p>
                Use your résumé to create questions from your real skills, projects, education and
                experience.
              </p>
              <strong>
                Deeper personalisation <ArrowRight aria-hidden="true" />
              </strong>
            </button>
            <button type="button" className="practice-choice" onClick={() => choosePath("quick")}>
              <span className="practice-choice__number">Quick start</span>
              <Zap aria-hidden="true" />
              <h3>Quick Practice</h3>
              <p>Start with a target role, company and interview type without using a résumé.</p>
              <strong>
                Use the essentials <ArrowRight aria-hidden="true" />
              </strong>
            </button>
          </div>
        </section>
      )}

      {showProfileSummary && profile && (
        <section
          className="practice-profile-summary app-panel"
          aria-labelledby="practice-profile-title"
        >
          <div>
            <span className="status-pill status-pill--success">Professional Profile ready</span>
            <h2 id="practice-profile-title">Continue with your existing profile.</h2>
            <p>{profile.summary || "Your analysed résumé is ready to personalise this session."}</p>
          </div>
          <dl>
            <div>
              <dt>Current résumé</dt>
              <dd>{profile.fileName || "Analysed résumé"}</dd>
            </div>
            <div>
              <dt>Analysed</dt>
              <dd>
                {profile.uploadedAt
                  ? new Date(profile.uploadedAt).toLocaleDateString()
                  : "Available"}
              </dd>
            </div>
            <div>
              <dt>Key skills</dt>
              <dd>{profile.skills?.slice(0, 4).join(", ") || "Review profile"}</dd>
            </div>
            <div>
              <dt>Recommended role</dt>
              <dd>{profile.recommendedRoles?.[0] || "Choose during setup"}</dd>
            </div>
          </dl>
          <div className="practice-profile-summary__actions">
            <Button size="lg" onClick={continueWithProfile}>
              Continue with this profile
            </Button>
            <Button asChild variant="outline">
              <Link to="/resume" search={{ from: "practice" }}>
                Review full profile
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/resume" search={{ from: "practice" }}>
                Replace résumé
              </Link>
            </Button>
            <Button variant="ghost" onClick={returnToChoices}>
              Choose another path
            </Button>
          </div>
        </section>
      )}

      {showMissingProfile && (
        <section className="practice-profile-summary app-panel">
          <div>
            <span className="status-pill">Professional Profile required</span>
            <h2>Create your Professional Profile first.</h2>
            <p>
              Personalised Practice uses an analysed English résumé to create questions from your
              real skills, projects, education and experience.
            </p>
          </div>
          <div className="practice-profile-summary__actions">
            <Button asChild size="lg">
              <Link to="/resume" search={{ from: "practice" }}>
                Create Professional Profile
              </Link>
            </Button>
            <Button variant="outline" onClick={returnToChoices}>
              Return to practice choices
            </Button>
          </div>
        </section>
      )}

      {showSetup && draft.path && (
        <section className="practice-setup-section">
          <div className="practice-setup-section__header">
            <div>
              <p className="app-eyebrow">
                {draft.path === "personalized" ? "Personalised Practice" : "Quick Practice"}
              </p>
              <h2>Complete your session setup.</h2>
              <p>
                {draft.path === "personalized"
                  ? "Your Professional Profile will be included in question generation."
                  : "This session will not use résumé or Professional Profile data."}
              </p>
            </div>
            <Button variant="outline" onClick={returnToChoices}>
              Change path
            </Button>
          </div>
          <div className="app-panel p-6 sm:p-8">
            <InterviewSetupForm key={draft.path} practicePath={draft.path} />
          </div>
        </section>
      )}
    </div>
  );
}
