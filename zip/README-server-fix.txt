InterviewReady server.js marking-system update

Replace:
  server/server.js

with:
  server.js

This update:
- Passes expectedFocus and question category into answer evaluation.
- Passes job-description, resume, education, project, and company context.
- Handles non_answer responses such as "I don't know" deterministically.
- Prevents fake strengths for blank, nonsense, non-answer, and unrelated responses.
- Produces question-specific improved answers without inventing experience.
- Passes voice/video speech-to-text mode to suspicious-score checks.
- Improves reviewer instructions and score-to-feedback consistency.
- Keeps deterministic and AI fallback sources clearly separated.

Required companion file:
- Use the humane-v3 evaluation.js supplied previously.

Next required update:
- server/validation.js must allow the new analyze-answer fields, otherwise Zod may strip them.
