# Speech-delivery analysis

This feature provides approximate, supportive coaching from finalized browser transcripts and
relative microphone signal levels. It runs locally in the browser and stores derived metrics only;
raw microphone audio is neither persisted nor uploaded.

The measurements are not calibrated sound-pressure readings. Speaking pace varies naturally,
non-native speakers may pause more often, and browser recognition can mis-transcribe accents,
names, and technical terms. Accent, dialect, stutters, speech differences, assistive communication,
and microphone hardware must not be treated as evidence of low ability or low answer quality.
Filler matching is English-language and intentionally conservative.

The feature performs no speaker identification and makes no inference about confidence, anxiety,
honesty, intelligence, personality, emotion, disability, deception, employability, or medical
conditions. Browser signal analysis cannot reliably count speakers, so the overlapping-speech
metric remains unavailable instead of making an unsupported claim. These coaching signals are not
a hiring decision.

`SpeechRecognition` remains responsible for interim/final text. Because its browser API does not
expose a `MediaStream`, `useSpeechDeliveryAnalysis` owns the interview's single explicit audio
stream for Web Audio analysis. The stream stays alive during a temporary visual pause, while metric
timing stops; it is stopped and its `AudioContext` is closed when the interview route unmounts.
