import type { ExtendedInterviewSetup } from "./types";

export const TIPS = [
  "Use the STAR method: Situation, Task, Action, Result.",
  "Keep answers focused — 60–90 seconds is usually enough.",
  "Speak in concrete examples, not abstract claims.",
  "It's okay to pause and think before answering.",
];

export const DEFAULT_SETUP: ExtendedInterviewSetup = {
  /**
   * The role starts empty because users can enter
   * any target job role in the interview setup form.
   */
  role: "",

  targetCompany: "",
  targetRole: "",
  jobDescription: "",

  mode: "Text",
  type: "Mixed Interview",

  /**
   * The property remains named `difficulty` internally
   * for compatibility, but it now stores the selected
   * experience level.
   */
  difficulty: "Internship",

  questionCount: 5,

  resumeId: "",
  resume: undefined,

  resumeSummary: "",
  resumeSkills: [],
  resumeProjects: [],
  resumeEducation: "",

  companyContext: undefined,
};
