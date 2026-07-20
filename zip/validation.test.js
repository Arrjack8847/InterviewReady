import assert from "node:assert/strict";
import test from "node:test";

import { isUserOwnedResumePath, requestSchemas } from "./validation.js";

const userId = "11111111-1111-4111-8111-111111111111";

test("accepts only a resume path owned by the authenticated user", () => {
  assert.equal(isUserOwnedResumePath(`resumes/${userId}/resume.pdf`, userId), true);
  assert.equal(
    isUserOwnedResumePath("resumes/22222222-2222-4222-8222-222222222222/resume.pdf", userId),
    false,
  );
  assert.equal(isUserOwnedResumePath(`resumes/${userId}/../private.pdf`, userId), false);
});

test("resume extraction requires a UUID and rejects client-controlled paths", () => {
  assert.equal(requestSchemas.extractResume.safeParse({ resumeId: userId }).success, true);
  assert.equal(
    requestSchemas.extractResume.safeParse({ filePath: "resumes/other/file.pdf" }).success,
    false,
  );
  assert.equal(
    requestSchemas.extractResume.safeParse({ resumeId: userId, filePath: "resumes/other/file.pdf" })
      .success,
    false,
  );
});

test("answer evaluation accepts blank answers for deterministic zero scoring", () => {
  const result = requestSchemas.analyzeAnswer.safeParse({
    question: "How would you contribute to a team?",
    answer: "   ",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.answer, "");
});

test("interview request schemas normalize legacy interview types and experience levels", () => {
  const generateResult = requestSchemas.generateQuestions.safeParse({
    targetRole: "Doctor",
    type: "Technical Interview",
    difficulty: "Beginner",
  });
  const analyzeResult = requestSchemas.analyzeAnswer.safeParse({
    question: "Why are you interested in this role?",
    answer: "I want to contribute and continue learning.",
    type: "HR Interview",
    difficulty: "Intermediate",
  });
  const reportResult = requestSchemas.finalReport.safeParse({
    answers: [],
    type: "behavioural",
    difficulty: "Advanced",
  });

  assert.equal(generateResult.success, true);
  assert.equal(generateResult.data.type, "Role-Specific Interview");
  assert.equal(generateResult.data.difficulty, "Internship");
  assert.equal(analyzeResult.success, true);
  assert.equal(analyzeResult.data.type, "Screening Interview");
  assert.equal(analyzeResult.data.difficulty, "Entry Level");
  assert.equal(reportResult.success, true);
  assert.equal(reportResult.data.type, "Behavioral Interview");
  assert.equal(reportResult.data.difficulty, "Senior");
});

test("interview request schemas accept all canonical values and reject unknown values", () => {
  const interviewTypes = [
    "Mixed Interview",
    "Screening Interview",
    "Behavioral Interview",
    "Role-Specific Interview",
    "Situational Interview",
  ];
  const experienceLevels = [
    "Internship",
    "Graduate",
    "Entry Level",
    "Junior",
    "Mid Level",
    "Senior",
    "Management",
  ];

  for (const type of interviewTypes) {
    const result = requestSchemas.generateQuestions.safeParse({
      targetRole: "Custom Profession",
      type,
    });
    assert.equal(result.success, true, type);
    assert.equal(result.data.type, type);
  }

  for (const difficulty of experienceLevels) {
    const result = requestSchemas.generateQuestions.safeParse({
      targetRole: "Custom Profession",
      difficulty,
    });
    assert.equal(result.success, true, difficulty);
    assert.equal(result.data.difficulty, difficulty);
  }

  assert.equal(
    requestSchemas.generateQuestions.safeParse({
      targetRole: "Custom Profession",
      type: "Panel Interview",
    }).success,
    false,
  );
  assert.equal(
    requestSchemas.generateQuestions.safeParse({
      targetRole: "Custom Profession",
      difficulty: "Expert",
    }).success,
    false,
  );
});

test("acceptance scenarios preserve custom professions, canonical options, and all interview modes", () => {
  const scenarios = [
    ["Doctor", "Graduate", "Role-Specific Interview"],
    ["Junior Architect", "Entry Level", "Situational Interview"],
    ["Civil Engineer", "Senior", "Mixed Interview"],
    ["Teacher", "Internship", "Behavioral Interview"],
    ["Accountant", "Management", "Screening Interview"],
    ["Underwater Cultural Heritage Conservator", "Junior", "Mixed Interview"],
  ];

  for (const [targetRole, difficulty, type] of scenarios) {
    const result = requestSchemas.generateQuestions.safeParse({
      targetRole,
      difficulty,
      type,
    });

    assert.equal(result.success, true, `${targetRole} / ${difficulty} / ${type}`);
    assert.equal(result.data.targetRole, targetRole);
    assert.equal(result.data.difficulty, difficulty);
    assert.equal(result.data.type, type);
  }

  for (const mode of ["text", "voice", "video"]) {
    const result = requestSchemas.finalReport.safeParse({
      answers: [],
      targetRole: "Custom Profession",
      mode,
    });

    assert.equal(result.success, true, mode);
    assert.equal(result.data.mode, mode);
  }
});

test("answer evaluation accepts question-specific marking context", () => {
  const result = requestSchemas.analyzeAnswer.safeParse({
    question: "Tell me about a time you worked under pressure.",
    answer: "I stayed calm and followed the required procedure.",
    expectedFocus:
      "Describe the situation, personal responsibility, actions, result, and learning.",
    questionCategory: "Behavioral Interview",
    targetRole: "Pilot",
    targetCompany: "Example Aviation",
    jobDescription: "Support safe and professional flight operations.",
    resumeSummary: "A pilot trainee with simulator experience.",
    resumeSkills: ["Communication", "Safety awareness"],
    resumeProjects: ["Flight simulator training"],
    resumeEducation: "Pilot training programme",
    companyContext: {
      companyName: "Example Aviation",
      targetRole: "Pilot",
      interviewFocusAreas: ["Safety", "Decision-making"],
      sourceUrls: ["https://example.com/careers"],
    },
    mode: "video",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.expectedFocus.includes("situation"), true);
  assert.equal(result.data.questionCategory, "Behavioral Interview");
  assert.equal(result.data.mode, "video");
  assert.equal(result.data.companyContext.companyName, "Example Aviation");
});

test("answer evaluation normalizes common answer-mode aliases", () => {
  for (const [input, expected] of [
    ["Text", "text"],
    ["audio", "voice"],
    ["Camera", "video"],
  ]) {
    const result = requestSchemas.analyzeAnswer.safeParse({
      question: "Why are you interested in this role?",
      answer: "It fits my career goals.",
      mode: input,
    });

    assert.equal(result.success, true, input);
    assert.equal(result.data.mode, expected, input);
  }
});

test("answer evaluation rejects unsupported answer modes", () => {
  const result = requestSchemas.analyzeAnswer.safeParse({
    question: "Why are you interested in this role?",
    answer: "It fits my career goals.",
    mode: "hologram",
  });

  assert.equal(result.success, false);
});
