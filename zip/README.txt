InterviewReady - useInterviewSession TypeScript fix

Replace:
src/features/interview/hooks/useInterviewSession.ts

Fixes:
- Resolves TS2322 for question.category.
- Normalizes backend string categories into the Question category union.
- Preserves expectedFocus, category, difficulty, and backend question IDs.
- Safely restores answers when IDs are strings or numbers.
