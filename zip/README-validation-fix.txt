InterviewReady validation marking fix

Replace:
  server/validation.js
with:
  validation.js

Optional test update:
  Replace server/validation.test.js with validation.test.js

Changes:
- Accepts expectedFocus and questionCategory for answer evaluation.
- Accepts companyContext during question generation and answer evaluation.
- Accepts and normalizes text, voice, and video answer modes.
- Preserves resume, job-description, company, and role context.
- Keeps strict top-level request validation.
- Adds validation tests for the new marking-context fields.
