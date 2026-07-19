export const homeNavigation = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#resume-intelligence", label: "Résumé insights" },
  { href: "#practice-modes", label: "Practice" },
  { href: "#ai-feedback", label: "Feedback" },
  { href: "#progress", label: "Progress" },
] as const;

export const journeyStages = [
  {
    id: "experience",
    eyebrow: "01 · Résumé",
    title: "It starts with your experience.",
    description: "Your skills, projects and real experience form the foundation of every session.",
  },
  {
    id: "understanding",
    eyebrow: "02 · Understanding",
    title: "We understand what you have built.",
    description:
      "Your résumé becomes a structured profile of strengths, role matches and focus areas.",
  },
  {
    id: "questions",
    eyebrow: "03 · Questions",
    title: "Then we build the interview around you.",
    description:
      "Questions connect your background to the role, company, interview type, and experience level you choose.",
  },
  {
    id: "practice",
    eyebrow: "04 · Practice",
    title: "Practise the way you want to perform.",
    description: "Use text, voice or video to rehearse in the mode that matches your goal.",
  },
  {
    id: "feedback",
    eyebrow: "05 · Feedback",
    title: "See more than a score.",
    description: "Understand the evidence behind every score and how to strengthen the answer.",
  },
  {
    id: "next",
    eyebrow: "06 · Improvement",
    title: "Know exactly what to practise next.",
    description: "Continue with a focused session built from your latest performance.",
  },
] as const;

export const howItWorksSteps = [
  {
    number: "01",
    title: "Upload your résumé",
    description: "We identify your skills, projects, experience and strongest role matches.",
  },
  {
    number: "02",
    title: "Choose your target",
    description: "Select the role, company, interview type, and experience level you are preparing for.",
  },
  {
    number: "03",
    title: "Practise realistically",
    description: "Answer personalised questions using text, voice or video.",
  },
  {
    number: "04",
    title: "Improve with evidence",
    description: "Review clear feedback and continue with a recommended preparation plan.",
  },
] as const;

export const questionExamples = [
  {
    id: "resume",
    type: "Résumé-based",
    prompt:
      "You built an interview preparation platform. How did you design its AI evaluation workflow?",
    detail: "From your InterviewReady project",
  },
  {
    id: "role",
    type: "Role-based",
    prompt: "How would you structure a secure REST API for a banking application?",
    detail: "Junior Software Developer · Role-Specific",
  },
  {
    id: "company",
    type: "Company-based",
    prompt: "Why are you interested in working at Maybank as a software developer?",
    detail: "Maybank · Motivation",
  },
  {
    id: "behavioural",
    type: "Behavioural",
    prompt: "Tell me about a time you solved a difficult problem under pressure.",
    detail: "Problem solving · Mid Level",
  },
] as const;

export const practiceModes = [
  {
    id: "text",
    label: "Text",
    description: "Focus on answer structure, relevance, and role-specific knowledge.",
  },
  {
    id: "voice",
    label: "Voice",
    description: "Understand speaking pace, clarity, filler words and delivery consistency.",
  },
  {
    id: "video",
    label: "Video",
    description: "Review verbal delivery, camera presence and engagement.",
  },
] as const;

export type PracticeModeId = (typeof practiceModes)[number]["id"];

export const progressData = [
  { week: "Week 1", score: 62 },
  { week: "Week 2", score: 68 },
  { week: "Week 3", score: 73 },
  { week: "Week 4", score: 79 },
  { week: "Week 5", score: 84 },
] as const;
