InterviewReady marking-system update

File:
- useInterviewSession.ts

Important:
The pasted file is useInterviewSession.ts, not useInterviewSubmission.ts.

Changes:
- Preserves generated question IDs from the backend.
- Preserves category, difficulty, and expectedFocus.
- Saves the complete question objects to Supabase.
- Adds expectedFocus to local fallback questions.
- Handles string/number question IDs safely when restoring answers.
- Prevents stale answer and feedback state after session restoration.

Suggested project path:
src/features/interview/hooks/useInterviewSession.ts
