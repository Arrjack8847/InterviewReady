# InterviewReady frontend architecture

The active interview experience is implemented under `src/features/interview` and entered through
`src/routes/interview.tsx`. Text, voice, and video modes share the same interview state machine,
submission path, Supabase answer upsert, and canonical scoring pipeline.

Video calibration transfers one owned camera stream to the interview route. Face, posture, and hand
analysis share that stream and one coordinated frame loop. Voice and video modes use browser Speech
Recognition for text plus one explicit Web Audio stream for derived delivery measurements. The
Speech Recognition API does not expose its microphone stream, so the browser may manage that capture
independently. No raw audio or video is stored.

Completed answers persist versioned raw measurements, normalized coaching scores, availability
states, effective score weights, and integrity events in the existing answer JSON fields. Legacy
answers without that snapshot remain supported by the report compatibility adapters.
