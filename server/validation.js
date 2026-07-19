import { z } from "zod";

const shortText = z.string().trim().max(200);
const mediumText = z.string().trim().max(2_000);
const longText = z.string().trim().max(20_000);
const stringList = z
  .array(z.string().trim().max(500))
  .max(50);

export const INTERVIEW_TYPES = [
  "Mixed Interview",
  "Screening Interview",
  "Behavioral Interview",
  "Role-Specific Interview",
  "Situational Interview",
];

export const EXPERIENCE_LEVELS = [
  "Internship",
  "Graduate",
  "Entry Level",
  "Junior",
  "Mid Level",
  "Senior",
  "Management",
];

const INTERVIEW_TYPE_MAP = {
  mixed: "Mixed Interview",
  "mixed interview": "Mixed Interview",
  hr: "Screening Interview",
  "hr interview": "Screening Interview",
  screening: "Screening Interview",
  "screening interview": "Screening Interview",
  behavioral: "Behavioral Interview",
  behavioural: "Behavioral Interview",
  "behavioral interview": "Behavioral Interview",
  "behavioural interview": "Behavioral Interview",
  technical: "Role-Specific Interview",
  "technical interview": "Role-Specific Interview",
  "role-specific": "Role-Specific Interview",
  "role specific": "Role-Specific Interview",
  "role-specific interview": "Role-Specific Interview",
  "role specific interview": "Role-Specific Interview",
  situational: "Situational Interview",
  "situational interview": "Situational Interview",
};

const EXPERIENCE_LEVEL_MAP = {
  internship: "Internship",
  intern: "Internship",
  beginner: "Internship",
  graduate: "Graduate",
  "entry level": "Entry Level",
  "entry-level": "Entry Level",
  entrylevel: "Entry Level",
  intermediate: "Entry Level",
  junior: "Junior",
  "mid level": "Mid Level",
  "mid-level": "Mid Level",
  midlevel: "Mid Level",
  senior: "Senior",
  advanced: "Senior",
  management: "Management",
  manager: "Management",
};

function normalizeAliasedValue(value, aliases) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return value;

  const cleanValue = value.trim();
  return aliases[cleanValue.toLowerCase()] || cleanValue;
}

const interviewTypeSchema = z.preprocess(
  (value) => normalizeAliasedValue(value, INTERVIEW_TYPE_MAP),
  z.enum(INTERVIEW_TYPES).optional().default("Mixed Interview"),
);

/**
 * The API property remains named `difficulty` for compatibility,
 * but its value now represents the candidate's experience level.
 *
 * Older values are automatically converted:
 * - Beginner -> Internship
 * - Intermediate -> Entry Level
 * - Advanced -> Senior
 */
const experienceLevelSchema = z.preprocess(
  (value) => normalizeAliasedValue(value, EXPERIENCE_LEVEL_MAP),
  z
    .enum(EXPERIENCE_LEVELS)
    .optional()
    .default("Internship"),
);

const optionalContextFields = {
  targetRole: shortText.optional().default(""),
  targetCompany: shortText.optional().default(""),
  jobDescription: longText.optional().default(""),
  resumeSummary: longText.optional().default(""),
  resumeSkills: stringList.optional().default([]),
  resumeProjects: stringList.optional().default([]),
  resumeEducation: mediumText.optional().default(""),
};

function hasTargetRole(value) {
  const role =
    typeof value.role === "string"
      ? value.role.trim()
      : "";

  const targetRole =
    typeof value.targetRole === "string"
      ? value.targetRole.trim()
      : "";

  return Boolean(role || targetRole);
}

export const requestSchemas = {
  companyContext: z
    .object({
      targetCompany: shortText.min(
        1,
        "Target company is required.",
      ),

      targetRole: shortText
        .optional()
        .default(""),

      jobDescription: longText
        .optional()
        .default(""),

      resumeSummary: longText
        .optional()
        .default(""),

      resumeSkills: stringList
        .optional()
        .default([]),

      resumeProjects: stringList
        .optional()
        .default([]),
    })
    .strict(),

  generateQuestions: z
    .object({
      /**
       * Kept for compatibility with existing frontend,
       * database and backend code.
       *
       * This can contain any job title entered by the user.
       */
      role: shortText
        .optional()
        .default(""),

      type: interviewTypeSchema,

      /**
       * Internally called difficulty, but now represents
       * the target position's experience level.
       */
      difficulty: experienceLevelSchema,

      questionCount: z.coerce
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5),

      companyContext: z
        .record(
          z.string(),
          z.unknown(),
        )
        .optional(),

      ...optionalContextFields,
    })
    .strict()
    .superRefine((value, context) => {
      if (!hasTargetRole(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetRole"],
          message:
            "A target job role is required.",
        });
      }
    }),

  analyzeAnswer: z
    .object({
      question: mediumText.min(
        1,
        "Question is required.",
      ),

      /**
       * Blank answers are valid evaluation inputs
       * and should receive a deterministic score of zero.
       */
      answer: longText,

      /**
       * Do not default to a specific profession.
       * The server resolves targetRole first,
       * followed by role.
       */
      role: shortText
        .optional()
        .default(""),

      type: interviewTypeSchema,

      /**
       * Internally called difficulty, but now represents
       * the candidate's experience level.
       */
      difficulty: experienceLevelSchema,

      ...optionalContextFields,
    })
    .strict(),

  finalReport: z
    .object({
      answers: z
        .array(
          z
            .object({
              question: z
                .object({
                  id: z.union([
                    z
                      .string()
                      .max(100),

                    z
                      .number()
                      .int(),
                  ]),

                  text: mediumText,
                })
                .passthrough(),

              answer: longText,

              feedback: z.record(
                z.string(),
                z.unknown(),
              ),
            })
            .passthrough(),
        )
        .max(20),

      /**
       * No fixed job-role fallback.
       * Custom target roles are accepted.
       */
      role: shortText
        .optional()
        .default(""),

      type: interviewTypeSchema,

      /**
       * Internally called difficulty, but now represents
       * the candidate's experience level.
       */
      difficulty: experienceLevelSchema,

      mode: shortText
        .optional()
        .default("text"),

      speechMetrics: z
        .record(
          z.string(),
          z.unknown(),
        )
        .optional(),

      visualMetrics: z
        .record(
          z.string(),
          z.unknown(),
        )
        .optional(),

      ...optionalContextFields,
    })
    .strict(),

  extractResume: z
    .object({
      resumeId: z
        .string()
        .uuid(
          "A valid resumeId is required.",
        ),
    })
    .strict(),

  recommendCompanies: z
    .object({
      resumeSummary: longText
        .optional()
        .default(""),

      resumeSkills: stringList
        .optional()
        .default([]),

      resumeProjects: stringList
        .optional()
        .default([]),

      resumeEducation: mediumText
        .optional()
        .default(""),

      recommendedRoles: stringList
        .optional()
        .default([]),

      recommendedCompanyTypes: stringList
        .optional()
        .default([]),

      targetLocation: shortText
        .optional()
        .default(""),
    })
    .strict()
    .refine(
      (value) =>
        value.resumeSummary.length > 0 ||
        value.resumeSkills.length > 0,
      {
        message:
          "Resume summary or skills are required.",
      },
    ),
};

export function validateBody(schema) {
  return (req, res, next) => {
    const parsed =
      schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body.",

        issues: parsed.error.issues.map(
          (issue) => ({
            path:
              issue.path.join("."),

            message:
              issue.message,
          }),
        ),
      });
    }

    req.body = parsed.data;

    return next();
  };
}

export function isUserOwnedResumePath(
  filePath,
  userId,
) {
  if (!filePath || !userId) {
    return false;
  }

  const normalizedPath =
    String(filePath).replace(
      /\\/g,
      "/",
    );

  const expectedPrefix =
    `resumes/${userId}/`;

  return (
    normalizedPath.startsWith(
      expectedPrefix,
    ) &&
    !normalizedPath.includes("../")
  );
}
