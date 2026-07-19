import { extractResumeAnalysis } from "@/lib/api";
import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { createResumeRecord } from "@/lib/supabaseService";
import { normalizeExperienceLevel } from "@/lib/types";

export interface UploadedResumeResult {
  resumeId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;

  parsedSkills: string[];
  parsedProjects: string[];
  parsedEducation: string;
  parsedExperience: string[];

  resumeSummary: string;
  careerLevel: string;
  strongAreas: string[];
  weakAreas: string[];
  recommendedRoles: string[];
  recommendedCompanyTypes: string[];
  interviewFocusAreas: string[];

  source?: string;
  warning?: string;
}

const RESUME_BUCKET = "resumes";

function validateResumeFile(file: File) {
  const allowedExtensions = [".pdf", ".docx"];
  const fileName = file.name.toLowerCase();

  const isAllowedFile = allowedExtensions.some((extension) => fileName.endsWith(extension));

  if (!isAllowedFile) {
    throw new Error("Please upload a PDF or DOCX file.");
  }

  const fileSizeMb = file.size / (1024 * 1024);

  if (fileSizeMb > 5) {
    throw new Error("Resume file must be under 5MB.");
  }
}

export async function uploadResumeForUser({
  userId,
  file,
}: {
  userId?: string;
  file: File;
}): Promise<UploadedResumeResult> {
  requireSupabaseConfig();
  validateResumeFile(file);

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("User is not logged in.");
  }

  const finalUserId = authData.user.id;

  if (userId && userId !== finalUserId) {
    console.warn("Resume upload userId mismatch detected. Using Supabase Auth user id.", {
      passedUserId: userId,
      authUserId: finalUserId,
    });
  }

  const safeFileName = file.name.replace(/[^\w.-]/g, "_");
  const filePath = `resumes/${finalUserId}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from(RESUME_BUCKET).upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);

  if (signedUrlError) {
    throw signedUrlError;
  }

  const fileUrl = signedUrlData.signedUrl;

  let resumeId: string;

  try {
    resumeId = await createResumeRecord({
      userId: finalUserId,
      fileName: file.name,
      // Signed URLs expire. Persist the stable storage path and create URLs only for display.
      fileUrl: "",
      filePath,
      extractedText: "",
      parsedSkills: [],
      parsedProjects: [],
      parsedEducation: "",
      resumeSummary: "",
    });
  } catch (error) {
    await supabase.storage.from(RESUME_BUCKET).remove([filePath]);
    throw error;
  }

  const analysis = await extractResumeAnalysis({
    resumeId,
  });

  return {
    resumeId,
    fileName: file.name,
    fileUrl,
    filePath,

    parsedSkills: analysis.parsedSkills || [],
    parsedProjects: analysis.parsedProjects || [],
    parsedEducation: analysis.parsedEducation || "",
    parsedExperience: analysis.parsedExperience || [],

    resumeSummary: analysis.resumeSummary || "Resume analyzed successfully.",
    careerLevel: normalizeExperienceLevel(
      analysis.careerLevel,
      "Entry Level",
    ),
    strongAreas: analysis.strongAreas || [],
    weakAreas: analysis.weakAreas || [],
    recommendedRoles: analysis.recommendedRoles || [],
    recommendedCompanyTypes: analysis.recommendedCompanyTypes || [],
    interviewFocusAreas: analysis.interviewFocusAreas || [],

    source: analysis.source,
    warning: analysis.warning,
  };
}
