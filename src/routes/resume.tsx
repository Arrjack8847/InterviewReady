import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { RequireAuth } from "@/components/RequireAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { recommendCompanies, type CompanyRecommendationResponse } from "@/lib/api";
import { uploadResumeForUser } from "@/lib/resumeService";
import { savePracticeDraft } from "@/lib/practiceDraft";

type ProfileSource = "practice" | "today" | "account";
type ProfileView = "creation" | "selected" | "processing" | "failure" | "profile";

function getProfileSource(value: unknown): ProfileSource | undefined {
  return value === "practice" || value === "today" || value === "account" ? value : undefined;
}

export const Route = createFileRoute("/resume")({
  validateSearch: (search: Record<string, unknown>): { from?: ProfileSource } => ({
    from: getProfileSource(search.from),
  }),
  head: () => ({
    meta: [
      { title: "Professional Profile — InterviewReady" },
      {
        name: "description",
        content: "Build a Professional Profile from your résumé for personalised practice.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ProfessionalProfilePage />
    </RequireAuth>
  ),
});

type ResumeData = {
  resumeId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  uploadedAt: string;
  skills: string[];
  projects: string[];
  recommendedRoles: string[];
  recommendedCompanyTypes: string[];
  interviewFocusAreas: string[];
  strongAreas: string[];
  weakAreas: string[];
  parsedExperience: string[];
  summary: string;
  education: string;
  careerLevel: string;
  source?: string;
  warning?: string;
};

const RESUME_STORAGE_KEY = "ir.resume";
const COMPANY_RECOMMENDATION_STORAGE_KEY = "ir.companyRecommendations";
const SELECTED_INTERVIEW_TARGET_KEY = "ir.selectedInterviewTarget";

function ProfessionalProfilePage() {
  const { user } = useAuth();
  const { from } = Route.useSearch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [view, setView] = useState<ProfileView>("creation");
  const [companyRecommendations, setCompanyRecommendations] =
    useState<CompanyRecommendationResponse | null>(null);
  const [error, setError] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{
    targetRole?: string;
    targetCompany?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedResume = localStorage.getItem(RESUME_STORAGE_KEY);
    if (savedResume) {
      try {
        setResume(JSON.parse(savedResume) as ResumeData);
        setView("profile");
      } catch {
        localStorage.removeItem(RESUME_STORAGE_KEY);
      }
    }

    const savedRecommendations = localStorage.getItem(COMPANY_RECOMMENDATION_STORAGE_KEY);
    if (savedRecommendations) {
      try {
        setCompanyRecommendations(
          JSON.parse(savedRecommendations) as CompanyRecommendationResponse,
        );
      } catch {
        localStorage.removeItem(COMPANY_RECOMMENDATION_STORAGE_KEY);
      }
    }

    const savedTarget = localStorage.getItem(SELECTED_INTERVIEW_TARGET_KEY);
    if (savedTarget) {
      try {
        setSelectedTarget(
          JSON.parse(savedTarget) as {
            targetRole?: string;
            targetCompany?: string;
          },
        );
      } catch {
        localStorage.removeItem(SELECTED_INTERVIEW_TARGET_KEY);
      }
    }
  }, []);

  const validateAndSelectFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setSelectedFile(null);
      setError("Choose a PDF or DOCX résumé.");
      setView("failure");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      setError("Choose a résumé smaller than 5 MB.");
      setView("failure");
      return;
    }
    setSelectedFile(file);
    setError("");
    setView("selected");
  };

  const handleAnalyzeResume = async () => {
    if (!selectedFile || !user) {
      setError("Choose a résumé before starting analysis.");
      setView("failure");
      return;
    }

    try {
      setView("processing");
      setError("");
      const result = await uploadResumeForUser({ file: selectedFile });
      const uploadedResume: ResumeData = {
        resumeId: result.resumeId,
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        filePath: result.filePath,
        fileType: selectedFile.type || getFileKind(selectedFile.name),
        fileSize: selectedFile.size,
        uploadedAt: new Date().toISOString(),
        skills: result.parsedSkills || [],
        projects: result.parsedProjects || [],
        recommendedRoles: result.recommendedRoles || [],
        recommendedCompanyTypes: result.recommendedCompanyTypes || [],
        interviewFocusAreas: result.interviewFocusAreas || [],
        strongAreas: result.strongAreas || [],
        weakAreas: result.weakAreas || [],
        parsedExperience: result.parsedExperience || [],
        summary: result.resumeSummary || "Résumé analysed successfully.",
        education: result.parsedEducation || "",
        careerLevel: result.careerLevel || "Entry Level",
        source: result.source,
        warning: result.warning,
      };

      setResume(uploadedResume);
      setSelectedFile(null);
      setJustCompleted(true);
      setView("profile");
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(uploadedResume));
      setCompanyRecommendations(null);
      setSelectedTarget(null);
      localStorage.removeItem(COMPANY_RECOMMENDATION_STORAGE_KEY);
      localStorage.removeItem(SELECTED_INTERVIEW_TARGET_KEY);
    } catch (analysisError) {
      console.error("Résumé analysis failed:", analysisError);
      setError("We could not complete the résumé analysis. Try again or choose another document.");
      setView("failure");
    }
  };

  const handleGenerateCompanyRecommendations = async () => {
    if (!resume) return;
    try {
      setError("");
      setRecommending(true);
      const result = await recommendCompanies({
        resumeSummary: resume.summary,
        resumeSkills: resume.skills,
        resumeProjects: resume.projects,
        resumeEducation: resume.education,
        recommendedRoles: resume.recommendedRoles,
        recommendedCompanyTypes: resume.recommendedCompanyTypes,
        targetLocation: "Malaysia",
      });
      setCompanyRecommendations(result);
      localStorage.setItem(COMPANY_RECOMMENDATION_STORAGE_KEY, JSON.stringify(result));
    } catch (recommendationError) {
      console.error("Company recommendation failed:", recommendationError);
      setError("We could not prepare company recommendations. Please try again.");
    } finally {
      setRecommending(false);
    }
  };

  const handleUseRecommendation = ({
    targetRole,
    targetCompany,
    companyType,
  }: {
    targetRole?: string;
    targetCompany?: string;
    companyType?: string;
  }) => {
    const nextTarget = {
      targetRole: targetRole || "",
      targetCompany: targetCompany || "",
      companyType: companyType || "",
      selectedAt: new Date().toISOString(),
    };
    localStorage.setItem(SELECTED_INTERVIEW_TARGET_KEY, JSON.stringify(nextTarget));
    setSelectedTarget(nextTarget);
    savePracticeDraft({
      path: "personalized",
      stage: "setup",
      targetRole,
      targetCompany,
      companyType,
    });
    window.location.href = "/start";
  };

  const continueToPersonalisedSetup = () => {
    savePracticeDraft({ path: "personalized", stage: "setup" });
    window.location.href = "/start";
  };

  const handleDeleteResume = () => {
    setResume(null);
    setSelectedFile(null);
    setCompanyRecommendations(null);
    setSelectedTarget(null);
    setError("");
    setJustCompleted(false);
    setView("creation");
    localStorage.removeItem(RESUME_STORAGE_KEY);
    localStorage.removeItem(COMPANY_RECOMMENDATION_STORAGE_KEY);
    localStorage.removeItem(SELECTED_INTERVIEW_TARGET_KEY);
  };

  const chooseAnotherFile = () => {
    setError("");
    fileInputRef.current?.click();
  };

  const returnAction =
    from === "practice" ? (
      <Button asChild variant="outline">
        <Link to="/start">Return to Practice</Link>
      </Button>
    ) : from === "today" ? (
      <Button asChild variant="outline">
        <Link to="/dashboard">Return to Dashboard</Link>
      </Button>
    ) : undefined;

  return (
    <main className="app-container profile-page">
      <PageHeader
        eyebrow="Professional Profile"
        title={resume ? "Your professional story." : "Create your professional profile."}
        description={
          resume
            ? "Review the evidence InterviewReady uses to personalise your questions, feedback and role recommendations."
            : "Upload an English résumé so InterviewReady can understand your skills, education, projects and experience—and use them to personalise your preparation."
        }
        actions={returnAction}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-label="Choose an English résumé"
        disabled={view === "processing"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) validateAndSelectFile(file);
          event.target.value = "";
        }}
      />

      {view !== "profile" || !resume ? (
        <ProfileCreation
          view={view}
          file={selectedFile}
          error={error}
          hasExistingProfile={Boolean(resume)}
          onChooseFile={chooseAnotherFile}
          onAnalyze={() => void handleAnalyzeResume()}
          onRetry={() => void handleAnalyzeResume()}
          onKeepExisting={() => setView(resume ? "profile" : "creation")}
          from={from}
        />
      ) : (
        <>
          {justCompleted && (
            <div className="profile-ready-notice" role="status" aria-live="polite">
              <Check aria-hidden="true" />
              <div>
                <strong>Professional Profile ready</strong>
                <p>Your résumé is ready to personalise your interview preparation.</p>
              </div>
              <button type="button" onClick={() => setJustCompleted(false)}>
                Dismiss
              </button>
            </div>
          )}

          <section className="profile-document app-panel" aria-labelledby="profile-document-title">
            <div>
              <p className="app-eyebrow">Source document</p>
              <h2 id="profile-document-title">Current résumé</h2>
              <p>This résumé personalises your questions, feedback and role recommendations.</p>
            </div>
            <div className="profile-document__details">
              <FileText aria-hidden="true" />
              <div>
                <strong>{resume.fileName}</strong>
                <span>
                  {getFileKind(resume.fileName)} · {formatFileSize(resume.fileSize || 0)} · Analysed{" "}
                  {formatDate(resume.uploadedAt)}
                </span>
              </div>
              <span className="status-pill status-pill--success">Profile ready</span>
            </div>
            <div className="profile-document__actions">
              {resume.fileUrl && (
                <Button asChild size="sm" variant="outline">
                  <a href={resume.fileUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" /> Open file
                  </a>
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <RefreshCw aria-hidden="true" /> Replace résumé
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Replace the current résumé?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A new document will rebuild your Professional Profile. Your previous interview
                      sessions are not changed by this action.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep current résumé</AlertDialogCancel>
                    <AlertDialogAction onClick={chooseAnotherFile}>
                      Choose replacement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" /> Remove profile
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this Professional Profile?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the current profile from this browser. Your previous interview
                      sessions remain available. Personalised Practice will require another analysed
                      résumé.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteResume}>
                      Remove profile
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>

          {resume.warning && (
            <div className="profile-warning" role="status">
              <AlertCircle aria-hidden="true" />
              <p>{resume.warning}</p>
            </div>
          )}

          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}

          <ProfileSection number="01" title="Your professional story">
            <div className="profile-story-grid">
              <p className="profile-lead">{resume.summary || "Not identified from résumé"}</p>
              <dl className="profile-facts">
                <ProfileFact label="Current level" value={resume.careerLevel} />
                <ProfileFact label="Education" value={resume.education} />
                <ProfileFact label="Primary direction" value={resume.recommendedRoles[0]} />
                <ProfileFact label="Core focus" value={resume.skills.slice(0, 4).join(", ")} />
              </dl>
            </div>
          </ProfileSection>

          <ProfileSection number="02" title="Evidence from your résumé">
            <div className="profile-columns">
              <ProfileGroup title="Skills and technologies">
                <BadgeList items={resume.skills} emptyText="No skills were identified." />
              </ProfileGroup>
              <ProfileGroup title="Projects">
                <EditorialList items={resume.projects} emptyText="No projects were identified." />
              </ProfileGroup>
              <ProfileGroup title="Experience">
                <EditorialList
                  items={resume.parsedExperience}
                  emptyText="No experience was identified."
                />
              </ProfileGroup>
              <ProfileGroup title="Education">
                <p>{resume.education || "Not identified from résumé"}</p>
              </ProfileGroup>
            </div>
          </ProfileSection>

          <ProfileSection number="03" title="Interview readiness">
            <div className="profile-columns">
              <ProfileGroup title="Strong evidence">
                <EditorialList
                  items={resume.strongAreas}
                  emptyText="No strong evidence was identified."
                />
              </ProfileGroup>
              <ProfileGroup title="Preparation opportunities">
                <EditorialList
                  items={resume.weakAreas}
                  emptyText="No preparation opportunities were identified."
                />
              </ProfileGroup>
              <ProfileGroup title="Interview focus areas" wide>
                <EditorialList
                  items={resume.interviewFocusAreas}
                  emptyText="No interview focus areas were identified."
                />
              </ProfileGroup>
            </div>
          </ProfileSection>

          <ProfileSection number="04" title="Where this profile fits">
            <div className="profile-fit-intro">
              <div>
                <ProfileGroup title="Recommended roles">
                  <RecommendationChoices
                    items={resume.recommendedRoles}
                    actionLabel="Practise for this role"
                    onSelect={(item) => handleUseRecommendation({ targetRole: item })}
                  />
                </ProfileGroup>
                <ProfileGroup title="Recommended company environments">
                  <BadgeList
                    items={resume.recommendedCompanyTypes}
                    emptyText="No company environments were identified."
                  />
                </ProfileGroup>
              </div>
              <div className="profile-recommendation-action">
                <h3>Company recommendations</h3>
                <p>Generate real company suggestions from the evidence in this profile.</p>
                <Button
                  onClick={() => void handleGenerateCompanyRecommendations()}
                  disabled={recommending}
                >
                  {recommending && <RefreshCw className="animate-spin" aria-hidden="true" />}
                  {recommending
                    ? "Preparing recommendations…"
                    : companyRecommendations
                      ? "Refresh recommendations"
                      : "Generate recommendations"}
                </Button>
              </div>
            </div>

            {companyRecommendations && (
              <div className="profile-recommendations" aria-live="polite">
                <ProfileGroup title="Role matches">
                  {companyRecommendations.recommendedRoles.map((item) => (
                    <RecommendationRow
                      key={item.role}
                      title={item.role}
                      description={item.reason}
                      meta={`${item.matchScore}% match`}
                      action="Use role"
                      onClick={() => handleUseRecommendation({ targetRole: item.role })}
                    />
                  ))}
                </ProfileGroup>
                <ProfileGroup title="Suggested companies">
                  {companyRecommendations.suggestedCompanies.map((company) => (
                    <RecommendationRow
                      key={`${company.name}-${company.type}`}
                      title={company.name}
                      description={company.reason}
                      meta={`${company.type} · ${company.matchScore}% match`}
                      action="Use company"
                      onClick={() =>
                        handleUseRecommendation({
                          targetCompany: company.name,
                          companyType: company.type,
                        })
                      }
                    />
                  ))}
                </ProfileGroup>
                <ProfileGroup title="Interview focus" wide>
                  <EditorialList
                    items={companyRecommendations.interviewFocusAreas}
                    emptyText="No additional interview focus areas were generated."
                  />
                  <div className="mt-5">
                    <BadgeList
                      items={companyRecommendations.recommendedCompanyTypes}
                      emptyText="No additional company environments were generated."
                    />
                  </div>
                  {companyRecommendations.warning && (
                    <p className="profile-empty-value">{companyRecommendations.warning}</p>
                  )}
                </ProfileGroup>
              </div>
            )}
          </ProfileSection>

          <section className="profile-practice app-panel">
            <p className="app-eyebrow">Next step</p>
            <h2>Your profile is ready for practice.</h2>
            <p>
              InterviewReady can now create questions from your skills, projects, experience and
              preparation opportunities.
            </p>
            <dl className="profile-selected-target">
              <div>
                <dt>Professional Profile</dt>
                <dd>Ready</dd>
              </div>
              <div>
                <dt>Target role</dt>
                <dd>{selectedTarget?.targetRole || "Choose during setup"}</dd>
              </div>
              <div>
                <dt>Target company</dt>
                <dd>{selectedTarget?.targetCompany || "Optional"}</dd>
              </div>
            </dl>
            <div>
              <Button size="lg" onClick={continueToPersonalisedSetup}>
                Start Personalised Practice <ArrowRight aria-hidden="true" />
              </Button>
              {from === "today" && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/dashboard">Return to Dashboard</Link>
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function ProfileCreation({
  view,
  file,
  error,
  hasExistingProfile,
  onChooseFile,
  onAnalyze,
  onRetry,
  onKeepExisting,
  from,
}: {
  view: ProfileView;
  file: File | null;
  error: string;
  hasExistingProfile: boolean;
  onChooseFile: () => void;
  onAnalyze: () => void;
  onRetry: () => void;
  onKeepExisting: () => void;
  from?: ProfileSource;
}) {
  if (view === "processing") {
    return (
      <section className="profile-processing app-panel" role="status" aria-live="polite">
        <span className="app-state__loader" aria-hidden="true" />
        <p className="app-eyebrow">Résumé analysis</p>
        <h2>Building your Professional Profile</h2>
        <p>
          InterviewReady is uploading and organising your résumé into evidence that can personalise
          your questions and feedback.
        </p>
        <small>Please keep this page open while the analysis completes.</small>
      </section>
    );
  }

  if (view === "failure") {
    return (
      <section className="profile-failure app-panel" aria-labelledby="profile-failure-title">
        <AlertCircle aria-hidden="true" />
        <p className="app-eyebrow">Analysis interrupted</p>
        <h2 id="profile-failure-title">We could not complete the résumé analysis.</h2>
        <p role="alert">{error}</p>
        <div>
          {file && <Button onClick={onRetry}>Try analysis again</Button>}
          <Button variant="outline" onClick={onChooseFile}>
            Upload another résumé
          </Button>
          {hasExistingProfile && (
            <Button variant="ghost" onClick={onKeepExisting}>
              Keep current profile
            </Button>
          )}
          {from === "practice" && (
            <Button asChild variant="ghost">
              <Link to="/start">Return to Practice</Link>
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="profile-creation">
      <div className="profile-creation__explanation">
        <p className="app-eyebrow">Résumé to profile</p>
        <h2>The document is the source. The profile makes it useful.</h2>
        <p>
          InterviewReady identifies only evidence available in your résumé and organises it for
          personalised preparation.
        </p>
        <ul>
          {[
            "Career identity",
            "Education and experience",
            "Skills and technologies",
            "Projects and achievements",
            "Interview strengths",
            "Preparation opportunities",
            "Suitable roles and environments",
          ].map((item) => (
            <li key={item}>
              <Check aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
        <small>
          Your résumé is stored with your authenticated account and used to build your preparation
          context.
        </small>
      </div>

      <div className="profile-upload-panel app-panel">
        {view === "selected" && file ? (
          <>
            <span className="status-pill status-pill--success">Ready to analyse</span>
            <FileText className="profile-upload-panel__icon" aria-hidden="true" />
            <h2>{file.name}</h2>
            <dl>
              <div>
                <dt>File type</dt>
                <dd>{getFileKind(file.name)}</dd>
              </div>
              <div>
                <dt>File size</dt>
                <dd>{formatFileSize(file.size)}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>PDF/DOCX and size checks passed</dd>
              </div>
            </dl>
            <Button size="lg" onClick={onAnalyze}>
              Analyse résumé
            </Button>
            <Button variant="outline" onClick={onChooseFile}>
              Choose another file
            </Button>
          </>
        ) : (
          <>
            <Upload className="profile-upload-panel__icon" aria-hidden="true" />
            <h2>Choose your English résumé</h2>
            <p>PDF or DOCX · Maximum 5 MB</p>
            <Button size="lg" onClick={onChooseFile}>
              Select document
            </Button>
            <small>Analysis starts only after you confirm the selected document.</small>
          </>
        )}
      </div>
    </section>
  );
}

function ProfileSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="profile-section" aria-labelledby={`profile-section-${number}`}>
      <header>
        <span>{number}</span>
        <h2 id={`profile-section-${number}`}>{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ProfileGroup({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "profile-group profile-group--wide" : "profile-group"}>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Not identified from résumé"}</dd>
    </div>
  );
}

function BadgeList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) return <p className="profile-empty-value">{emptyText}</p>;
  return (
    <div className="profile-badges">
      {items.map((item) => (
        <Badge key={item} variant="secondary">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function EditorialList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) return <p className="profile-empty-value">{emptyText}</p>;
  return (
    <ul className="profile-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RecommendationChoices({
  items,
  actionLabel,
  onSelect,
}: {
  items: string[];
  actionLabel: string;
  onSelect: (item: string) => void;
}) {
  if (!items.length) return <p className="profile-empty-value">No roles were identified.</p>;
  return (
    <div className="profile-choices">
      {items.map((item) => (
        <button type="button" key={item} onClick={() => onSelect(item)}>
          <span>{item}</span>
          <strong>{actionLabel}</strong>
        </button>
      ))}
    </div>
  );
}

function RecommendationRow({
  title,
  description,
  meta,
  action,
  onClick,
}: {
  title: string;
  description: string;
  meta: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="profile-recommendation-row">
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
        <p>{description}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onClick}>
        {action}
      </Button>
    </article>
  );
}

function getFileKind(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
}

function formatFileSize(bytes: number) {
  if (!bytes) return "Unknown size";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
