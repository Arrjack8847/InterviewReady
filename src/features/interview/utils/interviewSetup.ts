import { DEFAULT_SETUP } from "../constants";
import {
  normalizeExperienceLevel,
  normalizeInterviewType,
} from "@/lib/types";

import type {
  ExtendedInterviewSetup,
  InterviewModeLabel,
  SavedInterviewSession,
} from "../types";

type SelectedInterviewTarget = {
  targetRole?: string;
  targetCompany?: string;
  companyType?: string;
  selectedAt?: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function resolveText(
  ...values: unknown[]
): string {
  for (const value of values) {
    const cleanedValue = cleanText(value);

    if (cleanedValue) {
      return cleanedValue;
    }
  }

  return "";
}

export function readSelectedInterviewTarget(): SelectedInterviewTarget {
  if (typeof window === "undefined") {
    return {
      targetRole: "",
      targetCompany: "",
      companyType: "",
    };
  }

  const raw = localStorage.getItem(
    "ir.selectedInterviewTarget",
  );

  if (!raw) {
    return {
      targetRole: "",
      targetCompany: "",
      companyType: "",
    };
  }

  try {
    const parsed =
      JSON.parse(
        raw,
      ) as SelectedInterviewTarget;

    return {
      targetRole: cleanText(
        parsed.targetRole,
      ),

      targetCompany: cleanText(
        parsed.targetCompany,
      ),

      companyType: cleanText(
        parsed.companyType,
      ),

      selectedAt: cleanText(
        parsed.selectedAt,
      ),
    };
  } catch {
    localStorage.removeItem(
      "ir.selectedInterviewTarget",
    );

    return {
      targetRole: "",
      targetCompany: "",
      companyType: "",
    };
  }
}

export function readStoredSetup(): ExtendedInterviewSetup {
  const selectedTarget =
    readSelectedInterviewTarget();

  const raw =
    typeof window !== "undefined"
      ? localStorage.getItem("ir.setup")
      : null;

  if (!raw) {
    const resolvedRole = resolveText(
      selectedTarget.targetRole,
      DEFAULT_SETUP.targetRole,
      DEFAULT_SETUP.role,
    );

    return {
      ...DEFAULT_SETUP,

      role: resolvedRole,

      targetRole: resolvedRole,

      targetCompany: resolveText(
        selectedTarget.targetCompany,
        DEFAULT_SETUP.targetCompany,
      ),

      type: normalizeInterviewType(
        DEFAULT_SETUP.type,
        DEFAULT_SETUP.type,
      ),

      difficulty:
        normalizeExperienceLevel(
          DEFAULT_SETUP.difficulty,
          DEFAULT_SETUP.difficulty,
        ),
    };
  }

  try {
    const storedSetup =
      JSON.parse(
        raw,
      ) as Partial<ExtendedInterviewSetup>;

    const resolvedRole = resolveText(
      storedSetup.targetRole,
      selectedTarget.targetRole,
      storedSetup.role,
      DEFAULT_SETUP.targetRole,
      DEFAULT_SETUP.role,
    );

    return {
      ...DEFAULT_SETUP,
      ...storedSetup,

      /**
       * Keep the same custom job title in both
       * properties for old and new code paths.
       */
      role: resolvedRole,

      targetRole: resolvedRole,

      targetCompany: resolveText(
        storedSetup.targetCompany,
        selectedTarget.targetCompany,
        DEFAULT_SETUP.targetCompany,
      ),

      type: normalizeInterviewType(
        storedSetup.type,
        DEFAULT_SETUP.type,
      ),

      difficulty:
        normalizeExperienceLevel(
          storedSetup.difficulty,
          DEFAULT_SETUP.difficulty,
        ),
    };
  } catch {
    if (
      typeof window !== "undefined"
    ) {
      localStorage.removeItem(
        "ir.setup",
      );
    }

    const resolvedRole = resolveText(
      selectedTarget.targetRole,
      DEFAULT_SETUP.targetRole,
      DEFAULT_SETUP.role,
    );

    return {
      ...DEFAULT_SETUP,

      role: resolvedRole,

      targetRole: resolvedRole,

      targetCompany: resolveText(
        selectedTarget.targetCompany,
        DEFAULT_SETUP.targetCompany,
      ),

      type: normalizeInterviewType(
        DEFAULT_SETUP.type,
        DEFAULT_SETUP.type,
      ),

      difficulty:
        normalizeExperienceLevel(
          DEFAULT_SETUP.difficulty,
          DEFAULT_SETUP.difficulty,
        ),
    };
  }
}

export function buildSetupFromSession(
  session: NonNullable<SavedInterviewSession>,
  storedSetup: ExtendedInterviewSetup,
): ExtendedInterviewSetup {
  const resolvedRole = resolveText(
    session.targetRole,
    session.role,
    storedSetup.targetRole,
    storedSetup.role,
    DEFAULT_SETUP.targetRole,
    DEFAULT_SETUP.role,
  );

  return {
    ...DEFAULT_SETUP,
    ...storedSetup,

    /**
     * Keep both role properties synchronized.
     */
    role: resolvedRole,

    targetRole: resolvedRole,

    targetCompany: resolveText(
      session.targetCompany,
      storedSetup.targetCompany,
      DEFAULT_SETUP.targetCompany,
    ),

    jobDescription: resolveText(
      session.jobDescription,
      storedSetup.jobDescription,
      DEFAULT_SETUP.jobDescription,
    ),

    resumeId: resolveText(
      session.resumeId,
      storedSetup.resumeId,
      DEFAULT_SETUP.resumeId,
    ),

    mode:
      session.mode ||
      storedSetup.mode ||
      DEFAULT_SETUP.mode,

    type: normalizeInterviewType(
      session.interviewType ||
        session.type ||
        storedSetup.type,
      DEFAULT_SETUP.type,
    ),

    difficulty:
      normalizeExperienceLevel(
        session.difficulty ||
          storedSetup.difficulty,
        DEFAULT_SETUP.difficulty,
      ),

    questionCount:
      session.questionCount ||
      storedSetup.questionCount ||
      DEFAULT_SETUP.questionCount,
  };
}

export function getModeLabel(
  mode?: InterviewModeLabel,
): "Text" | "Voice" | "Video" {
  const normalizedMode = String(
    mode || "Text",
  )
    .trim()
    .toLowerCase();

  if (normalizedMode === "voice") {
    return "Voice";
  }

  if (normalizedMode === "video") {
    return "Video";
  }

  return "Text";
}
