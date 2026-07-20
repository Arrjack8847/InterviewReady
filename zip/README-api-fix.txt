InterviewReady API Marking Fix

Replace:
  src/lib/api.ts

with the included api.ts file.

Changes:
- AnalyzeAnswerInput now sends expectedFocus and questionCategory.
- Sends text/voice/video mode so speech-to-text answers can be judged fairly.
- Sends companyContext alongside role, resume, and job-description context.
- Maps characterCount and reconciliationMethod from the backend response.
- Uses InterviewModeValue for final-report mode instead of an unrestricted string.

This file is designed to work with the updated:
- server/evaluation.js
- server/server.js
- server/validation.js
- src/lib/types.ts
