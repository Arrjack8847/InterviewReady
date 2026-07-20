InterviewReady types marking fix
================================

Replace:
  src/lib/types.ts

with the included:
  types.ts

Changes:
- Question.id now accepts string or number IDs.
- Question preserves category, difficulty, and expectedFocus.
- Feedback.answerValidity supports non_answer.
- Reuses a shared EvaluationQuestionType.
- Adds characterCount and reconciliationMethod evaluation metadata.
- Adds mode normalization helpers for text, voice, and video.
- AnswerWithFeedback can preserve its answer mode.

Why it matters:
The generated expectedFocus and question metadata can now survive until answer
submission, allowing server.js and evaluation.js to produce question-specific
marks and improved answers.
