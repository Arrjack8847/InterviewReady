import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { COMMON_JOB_ROLES } from "@/data/jobRoles";
import { generateCompanyContext, type CompanyContextResponse } from "@/lib/api";
import {
  clearPracticeDraft,
  readPracticeDraft,
  savePracticeDraft,
  type PracticePath,
} from "@/lib/practiceDraft";
import { createInterviewSession } from "@/lib/supabaseService";
import {
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  normalizeExperienceLevel,
  normalizeInterviewType,
} from "@/lib/types";
import type {
  Difficulty,
  InterviewMode,
  InterviewSetup,
  InterviewType,
  ResumePreview,
} from "@/lib/types";

const INTERVIEW_TYPE_DESCRIPTIONS: Record<InterviewType, string> = {
  "Mixed Interview":
    "A balanced mix of screening, behavioral, role-specific, situational, company, and resume questions.",
  "Screening Interview":
    "Covers your background, motivation, availability, company interest, career goals, and general suitability.",
  "Behavioral Interview":
    "Uses past examples about teamwork, challenges, feedback, conflict, initiative, and leadership.",
  "Role-Specific Interview":
    "Focuses on the knowledge, responsibilities, judgement, tools, standards, and skills of your exact profession.",
  "Situational Interview":
    "Presents realistic workplace scenarios involving priorities, stakeholders, safety, ethics, and professional judgement.",
};

const MODES: InterviewMode[] = [
  "Text",
  "Voice",
  "Video",
];

const QUESTION_COUNTS = [3, 5, 10];

const RESUME_STORAGE_KEY = "ir.resume";
const SELECTED_INTERVIEW_TARGET_KEY = "ir.selectedInterviewTarget";
const COMPANY_CONTEXT_STORAGE_KEY = "ir.companyContext";

type SavedResume = ResumePreview & {
  resumeId?: string;
  fileName: string;
  fileUrl?: string;
  filePath?: string;
  fileSize?: number;
  uploadedAt?: string;

  skills?: string[];
  projects?: string[];
  targetRoles?: string[];

  recommendedRoles?: string[];
  recommendedCompanyTypes?: string[];
  interviewFocusAreas?: string[];
  strongAreas?: string[];
  weakAreas?: string[];
  parsedExperience?: string[];

  summary?: string;
  education?: string;
  careerLevel?: string;
  source?: string;
  warning?: string;
};

type SelectedInterviewTarget = {
  targetRole?: string;
  targetCompany?: string;
  companyType?: string;
  selectedAt?: string;
};

function getUserId(user: unknown) {
  const typedUser = user as {
    id?: string;
    uid?: string;
  } | null;

  return typedUser?.id || typedUser?.uid || "";
}

function readSavedResume() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(RESUME_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SavedResume;
  } catch {
    localStorage.removeItem(RESUME_STORAGE_KEY);
    return null;
  }
}

function readSelectedInterviewTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SELECTED_INTERVIEW_TARGET_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SelectedInterviewTarget;
  } catch {
    localStorage.removeItem(SELECTED_INTERVIEW_TARGET_KEY);
    return null;
  }
}

function readSavedCompanyContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(COMPANY_CONTEXT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CompanyContextResponse;
  } catch {
    localStorage.removeItem(COMPANY_CONTEXT_STORAGE_KEY);
    return null;
  }
}

function getBestResumeRole(resume: SavedResume | null) {
  if (!resume) {
    return "";
  }

  const recommendedRole = resume.recommendedRoles?.[0];
  const targetRole = resume.targetRoles?.[0];

  return recommendedRole || targetRole || "";
}

function validateTargetRole(value: string) {
  const cleanRole = value.trim();

  if (!cleanRole) {
    return "Please enter the job role you want to practise for.";
  }

  if (cleanRole.length < 3) {
    return "Please enter a more specific job role.";
  }

  if (cleanRole.length > 100) {
    return "The target job role must be 100 characters or fewer.";
  }

  if (!/[a-zA-Z]/.test(cleanRole)) {
    return "The target job role must contain letters.";
  }

  if (/^(.)\1{3,}$/i.test(cleanRole.replace(/\s/g, ""))) {
    return "Please enter a valid professional job role.";
  }

  return "";
}

export function InterviewSetupForm({
  practicePath,
}: {
  practicePath: PracticePath;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [type, setType] =
    useState<InterviewType>("Mixed Interview");

  const [difficulty, setDifficulty] =
    useState<Difficulty>("Internship");

  const [questionCount, setQuestionCount] =
    useState<number>(5);

  const [targetCompany, setTargetCompany] =
    useState("");

  const [targetRole, setTargetRole] =
    useState("");

  const [selectedCompanyType, setSelectedCompanyType] =
    useState("");

  const [jobDescription, setJobDescription] =
    useState("");

  const [mode, setMode] =
    useState<InterviewMode>("Text");

  const [resume, setResume] =
    useState<SavedResume | null>(null);

  const [companyContext, setCompanyContext] =
    useState<CompanyContextResponse | null>(null);

  const [error, setError] =
    useState("");

  const [researchingCompany, setResearchingCompany] =
    useState(false);

  const [starting, setStarting] =
    useState(false);

  const [draftLoaded, setDraftLoaded] =
    useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedResume =
      practicePath === "personalized"
        ? readSavedResume()
        : null;

    const selectedTarget =
      readSelectedInterviewTarget();

    const savedCompanyContext =
      practicePath === "personalized"
        ? readSavedCompanyContext()
        : null;

    const savedDraft =
      readPracticeDraft();

    /*
     * New drafts use targetRole.
     * Older drafts may only have role.
     */
    if (savedDraft.targetRole) {
      setTargetRole(savedDraft.targetRole);
    } else if (savedDraft.role) {
      setTargetRole(savedDraft.role);
    }

    if (savedDraft.targetCompany) {
      setTargetCompany(savedDraft.targetCompany);
    }

    if (savedDraft.companyType) {
      setSelectedCompanyType(savedDraft.companyType);
    }

    if (savedDraft.interviewType) {
      setType(
        normalizeInterviewType(
          savedDraft.interviewType,
        ),
      );
    }

    if (savedDraft.difficulty) {
      setDifficulty(
        normalizeExperienceLevel(
          savedDraft.difficulty,
        ),
      );
    }

    if (
      savedDraft.mode &&
      MODES.includes(savedDraft.mode)
    ) {
      setMode(savedDraft.mode);
    }

    if (
      savedDraft.questionCount &&
      QUESTION_COUNTS.includes(savedDraft.questionCount)
    ) {
      setQuestionCount(savedDraft.questionCount);
    }

    if (savedDraft.jobDescription) {
      setJobDescription(savedDraft.jobDescription);
    }

    if (savedResume) {
      setResume(savedResume);

      const bestResumeRole =
        getBestResumeRole(savedResume);

      /*
       * Only use the résumé recommendation when no role
       * is already stored in the current draft.
       */
      if (
        bestResumeRole &&
        !savedDraft.targetRole &&
        !savedDraft.role
      ) {
        setTargetRole(bestResumeRole);
      }
    }

    /*
     * A role selected from the professional-profile flow
     * overrides the draft and résumé recommendation.
     */
    if (selectedTarget?.targetRole) {
      setTargetRole(selectedTarget.targetRole);
    }

    if (selectedTarget?.targetCompany) {
      setTargetCompany(selectedTarget.targetCompany);
    }

    if (selectedTarget?.companyType) {
      setSelectedCompanyType(selectedTarget.companyType);
    }

    if (savedCompanyContext) {
      const selectedCompany =
        selectedTarget?.targetCompany
          ?.trim()
          .toLowerCase();

      const savedCompany =
        savedCompanyContext.companyName
          ?.trim()
          .toLowerCase();

      if (
        !selectedCompany ||
        selectedCompany === savedCompany
      ) {
        setCompanyContext(savedCompanyContext);
      } else {
        localStorage.removeItem(
          COMPANY_CONTEXT_STORAGE_KEY,
        );
      }
    }

    setDraftLoaded(true);
  }, [practicePath]);

  useEffect(() => {
    if (!draftLoaded) {
      return;
    }

    const cleanTargetRole =
      targetRole.trim();

    savePracticeDraft({
      path: practicePath,
      stage: "setup",

      /*
       * role remains for compatibility with existing
       * database records and backend functions.
       */
      role: cleanTargetRole,
      targetRole: cleanTargetRole,

      targetCompany,
      companyType: selectedCompanyType,
      interviewType: type,

      /*
       * The property remains named difficulty internally,
       * but it now stores the experience level.
       */
      difficulty,

      questionCount,
      mode,
      jobDescription,
    });
  }, [
    difficulty,
    draftLoaded,
    jobDescription,
    mode,
    practicePath,
    questionCount,
    selectedCompanyType,
    targetCompany,
    targetRole,
    type,
  ]);

  const clearCompanyContext = () => {
    setCompanyContext(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem(
        COMPANY_CONTEXT_STORAGE_KEY,
      );
    }
  };

  const handleTargetRoleChange = (
    value: string,
  ) => {
    setTargetRole(value);
    setError("");
    clearCompanyContext();
  };

  const handleRemoveSelectedTarget = () => {
    setTargetCompany("");
    setSelectedCompanyType("");
    clearCompanyContext();

    if (typeof window !== "undefined") {
      localStorage.removeItem(
        SELECTED_INTERVIEW_TARGET_KEY,
      );
    }
  };

  const handleResearchCompany = async () => {
    const cleanCompany =
      targetCompany.trim();

    const cleanTargetRole =
      targetRole.trim();

    const roleValidationError =
      validateTargetRole(cleanTargetRole);

    if (roleValidationError) {
      setError(roleValidationError);
      return;
    }

    if (!cleanCompany) {
      setError(
        "Enter or select a target company before researching.",
      );
      return;
    }

    try {
      setError("");
      setResearchingCompany(true);

      const context =
        await generateCompanyContext({
          targetCompany: cleanCompany,
          targetRole: cleanTargetRole,
          jobDescription:
            jobDescription.trim(),
          resumeSummary:
            resume?.summary || "",
          resumeSkills:
            resume?.skills || [],
          resumeProjects:
            resume?.projects || [],
        });

      setCompanyContext(context);

      localStorage.setItem(
        COMPANY_CONTEXT_STORAGE_KEY,
        JSON.stringify(context),
      );
    } catch (error) {
      console.error(
        "Failed to research company:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Company research failed. Please try again.",
      );
    } finally {
      setResearchingCompany(false);
    }
  };

  const buildSetup = (): InterviewSetup => {
    const cleanTargetRole =
      targetRole.trim();

    const activeResume =
      practicePath === "personalized"
        ? resume
        : null;

    return {
      /*
       * Both values store the exact role selected or typed
       * by the user for backward compatibility.
       */
      role: cleanTargetRole,
      targetRole: cleanTargetRole,

      targetCompany:
        targetCompany.trim(),

      jobDescription:
        jobDescription.trim(),

      resumeId:
        activeResume?.resumeId || "",

      mode,
      type,

      /*
       * Internally still called difficulty.
       * The value now represents experience level.
       */
      difficulty,

      questionCount,

      resume: activeResume
        ? {
            fileName:
              activeResume.fileName,

            fileUrl:
              activeResume.fileUrl,

            fileSize:
              activeResume.fileSize,

            uploadedAt:
              activeResume.uploadedAt,

            skills:
              activeResume.skills || [],

            projects:
              activeResume.projects || [],

            targetRoles:
              activeResume.recommendedRoles ||
              activeResume.targetRoles ||
              [],

            summary:
              activeResume.summary || "",

            education:
              activeResume.education || "",
          }
        : undefined,

      resumeSummary:
        activeResume?.summary || "",

      resumeSkills:
        activeResume?.skills || [],

      resumeProjects:
        activeResume?.projects || [],

      resumeEducation:
        activeResume?.education || "",

      companyContext:
        companyContext || undefined,
    };
  };

  const handleStart = async () => {
    if (starting) {
      return;
    }

    const roleValidationError =
      validateTargetRole(targetRole);

    if (roleValidationError) {
      setError(roleValidationError);
      return;
    }

    if (
      practicePath === "personalized" &&
      !resume
    ) {
      setError(
        "Build or select a Professional Profile before starting personalised practice.",
      );
      return;
    }

    const userId =
      getUserId(user);

    if (!userId) {
      setError(
        "You must be logged in to start an interview.",
      );
      return;
    }

    try {
      setError("");
      setStarting(true);

      const setup =
        buildSetup();

      const attemptId =
        crypto.randomUUID();

      localStorage.removeItem(
        "ir.sessionId",
      );

      localStorage.removeItem(
        "ir.session",
      );

      localStorage.removeItem(
        "ir.report",
      );

      localStorage.removeItem(
        "ir.activeAttemptId",
      );

      const sessionId =
        await createInterviewSession({
          userId,
          setup,
          attemptId,
        });

      localStorage.setItem(
        "ir.setup",
        JSON.stringify(setup),
      );

      localStorage.setItem(
        "ir.sessionId",
        sessionId,
      );

      localStorage.setItem(
        "ir.activeAttemptId",
        attemptId,
      );

      localStorage.removeItem(
        SELECTED_INTERVIEW_TARGET_KEY,
      );

      clearPracticeDraft();

      navigate({
        to: "/interview",
      });
    } catch (error) {
      console.error(
        "Failed to start interview session:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to start interview session. Please try again.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="interview-setup">
      <aside
        className="interview-setup__steps"
        aria-label="Interview setup steps"
      >
        <p>Session setup</p>

        <ol>
          {(practicePath === "personalized"
            ? [
                "Professional Profile",
                "Target role",
                "Interview preferences",
                "Experience level",
                "Practice mode",
                "Device readiness",
                "Review and begin",
              ]
            : [
                "Target role",
                "Interview preferences",
                "Experience level",
                "Practice mode",
                "Device readiness",
                "Review and begin",
              ]
          ).map((step, index) => (
            <li
              key={step}
              data-active={
                index === 0 || undefined
              }
            >
              <span>
                {String(index + 1).padStart(
                  2,
                  "0",
                )}
              </span>

              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </aside>

      <div className="interview-setup__workspace space-y-8">
        {error && (
          <div
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {(targetCompany ||
          selectedCompanyType) && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Selected recommendation
                </p>

                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {targetCompany && (
                    <p>
                      <span className="font-medium text-foreground">
                        Company:
                      </span>{" "}
                      {targetCompany}
                    </p>
                  )}

                  {targetRole && (
                    <p>
                      <span className="font-medium text-foreground">
                        Role:
                      </span>{" "}
                      {targetRole}
                    </p>
                  )}

                  {selectedCompanyType && (
                    <p>
                      <span className="font-medium text-foreground">
                        Company type:
                      </span>{" "}
                      {selectedCompanyType}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={
                  handleRemoveSelectedTarget
                }
              >
                Clear selection
              </Button>
            </div>
          </div>
        )}

        {companyContext && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Company interview prep
                </p>

                <h3 className="text-lg font-semibold text-foreground">
                  {
                    companyContext.companyName
                  }
                </h3>

                <p className="text-sm text-muted-foreground">
                  {
                    companyContext.targetRole
                  }{" "}
                  | {companyContext.industry}
                </p>
              </div>

              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {companyContext.source}
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {
                companyContext.companyOverview
              }
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CompanyContextList
                title="Role expectations"
                items={
                  companyContext.roleExpectations
                }
              />

              <CompanyContextList
                title="Company challenges"
                items={
                  companyContext.companyChallenges
                }
              />

              <CompanyContextList
                title="Scenario angles"
                items={
                  companyContext.scenarioQuestionAngles
                }
              />

              <CompanyContextList
                title="Interview focus"
                items={
                  companyContext.interviewFocusAreas
                }
              />
            </div>

            {companyContext.sourceUrls.length >
              0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-foreground">
                  Sources
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {companyContext.sourceUrls.map(
                    (url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                      >
                        Source {index + 1}
                      </a>
                    ),
                  )}
                </div>
              </div>
            )}

            {companyContext.warning && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {companyContext.warning}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="practice-target-role"
            label="Target job role"
          >
            <input
              id="practice-target-role"
              type="text"
              list="common-job-role-suggestions"
              value={targetRole}
              onChange={(event) =>
                handleTargetRoleChange(
                  event.target.value,
                )
              }
              placeholder="Search or enter any job role"
              autoComplete="organization-title"
              maxLength={100}
              aria-describedby="practice-target-role-help"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <datalist id="common-job-role-suggestions">
              {COMMON_JOB_ROLES.map(
                (jobRole) => (
                  <option
                    key={jobRole}
                    value={jobRole}
                  />
                ),
              )}
            </datalist>

            <p
              id="practice-target-role-help"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              Choose a suggested role such as
              Doctor, Architect or Engineer, or
              enter any custom job role.
            </p>
          </Field>

          <Field
            id="practice-target-company"
            label="Target company"
          >
            <input
              id="practice-target-company"
              value={targetCompany}
              onChange={(event) => {
                setTargetCompany(
                  event.target.value,
                );

                setSelectedCompanyType("");
                setError("");
                clearCompanyContext();
              }}
              placeholder="Example: Google, Maybank, AirAsia"
              maxLength={120}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={
                handleResearchCompany
              }
              disabled={
                researchingCompany ||
                !targetCompany.trim() ||
                !targetRole.trim()
              }
              className="mt-3"
            >
              {researchingCompany
                ? "Researching..."
                : "Research Company"}
            </Button>

            {!targetRole.trim() &&
              targetCompany.trim() && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter a target job role
                  before researching the
                  company.
                </p>
              )}

            {selectedCompanyType && (
              <p className="mt-2 text-xs text-muted-foreground">
                Selected company type:{" "}
                {selectedCompanyType}
              </p>
            )}
          </Field>

          <Field
            id="practice-interview-type"
            label="Interview Type"
          >
            <Select
              value={type}
              onValueChange={(value) =>
                setType(
                  normalizeInterviewType(
                    value,
                  ),
                )
              }
            >
              <SelectTrigger id="practice-interview-type">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {INTERVIEW_TYPES.map((item) => (
                  <SelectItem
                    key={item}
                    value={item}
                  >
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {INTERVIEW_TYPE_DESCRIPTIONS[type]}
            </p>
          </Field>

          <Field
            id="practice-difficulty"
            label="Experience Level"
          >
            <Select
              value={difficulty}
              onValueChange={(value) =>
                setDifficulty(
                  normalizeExperienceLevel(
                    value,
                  ),
                )
              }
            >
              <SelectTrigger id="practice-difficulty">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {EXPERIENCE_LEVELS.map(
                  (item) => (
                    <SelectItem
                      key={item}
                      value={item}
                    >
                      {item}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Select the seniority of the
              position you are preparing for.
            </p>
          </Field>

          <Field
            id="practice-mode"
            label="Interview mode"
          >
            <Select
              value={mode}
              onValueChange={(value) =>
                setMode(
                  value as InterviewMode,
                )
              }
            >
              <SelectTrigger id="practice-mode">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {MODES.map((item) => (
                  <SelectItem
                    key={item}
                    value={item}
                  >
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            id="practice-question-count"
            label="Number of questions"
          >
            <Select
              value={String(
                questionCount,
              )}
              onValueChange={(value) =>
                setQuestionCount(
                  Number(value),
                )
              }
            >
              <SelectTrigger id="practice-question-count">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {QUESTION_COUNTS.map(
                  (count) => (
                    <SelectItem
                      key={count}
                      value={String(count)}
                    >
                      {count} questions
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>

          {practicePath ===
            "personalized" && (
            <Field label="Professional Profile">
              {resume ? (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">
                    Selected:{" "}
                    {resume.fileName}
                  </div>

                  {resume.summary && (
                    <div className="mt-1 line-clamp-2">
                      {resume.summary}
                    </div>
                  )}

                  {(resume.skills || [])
                    .length > 0 && (
                    <div className="mt-2">
                      Skills:{" "}
                      {(
                        resume.skills || []
                      ).join(", ")}
                    </div>
                  )}

                  {(
                    resume.recommendedRoles ||
                    []
                  ).length > 0 && (
                    <div className="mt-1">
                      Recommended roles:{" "}
                      {(
                        resume.recommendedRoles ||
                        []
                      ).join(", ")}
                    </div>
                  )}

                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    <Link
                      to="/resume"
                      search={{
                        from: "practice",
                      }}
                    >
                      Manage Professional
                      Profile
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  No Professional Profile
                  found. Analyse a résumé
                  first for personalised
                  questions.

                  <div className="mt-3">
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="sm"
                    >
                      <Link
                        to="/resume"
                        search={{
                          from: "practice",
                        }}
                      >
                        Build Professional
                        Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </Field>
          )}

          <div className="sm:col-span-2">
            <Field
              id="practice-job-description"
              label="Job description optional"
            >
              <textarea
                id="practice-job-description"
                value={jobDescription}
                onChange={(event) => {
                  setJobDescription(
                    event.target.value,
                  );

                  clearCompanyContext();
                }}
                placeholder="Paste the job description here to generate more specific interview questions..."
                className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>
        </div>

        <section
          className="practice-review"
          aria-labelledby="practice-review-title"
        >
          <div>
            <p className="app-eyebrow">
              Review session
            </p>

            <h3 id="practice-review-title">
              Ready to begin?
            </h3>

            <p>
              Confirm the setup below.
              Voice and video device
              calibration will open before
              the first question.
            </p>
          </div>

          <dl>
            <div>
              <dt>Path</dt>

              <dd>
                {practicePath ===
                "personalized"
                  ? "Personalised"
                  : "Quick"}
              </dd>
            </div>

            <div>
              <dt>Target</dt>

              <dd>
                {targetRole.trim() ||
                  "No target role selected"}

                {targetCompany.trim()
                  ? ` at ${targetCompany.trim()}`
                  : ""}
              </dd>
            </div>

            <div>
              <dt>Interview Type</dt>

              <dd>{type}</dd>
            </div>

            <div>
              <dt>Experience Level</dt>

              <dd>{difficulty}</dd>
            </div>

            <div>
              <dt>Format</dt>

              <dd>
                {questionCount} questions ·{" "}
                {mode}
              </dd>
            </div>

            <div>
              <dt>
                Professional Profile
              </dt>

              <dd>
                {practicePath ===
                "personalized"
                  ? resume?.fileName ||
                    "Required"
                  : "Not used"}
              </dd>
            </div>

            <div>
              <dt>Device readiness</dt>

              <dd>
                {mode === "Text"
                  ? "No device check required"
                  : "Calibration opens next"}
              </dd>
            </div>
          </dl>
        </section>

        <Button
          size="lg"
          onClick={handleStart}
          disabled={
            starting ||
            !targetRole.trim() ||
            (practicePath ===
              "personalized" &&
              !resume)
          }
          className="w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          {starting
            ? "Starting Interview..."
            : "Begin Interview"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-sm font-medium"
      >
        {label}
      </Label>

      {children}
    </div>
  );
}

function CompanyContextList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium text-foreground">
        {title}
      </p>

      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
        {items
          .slice(0, 4)
          .map((item) => (
            <li key={item}>
              - {item}
            </li>
          ))}
      </ul>
    </div>
  );
}
