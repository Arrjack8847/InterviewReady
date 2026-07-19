# Canonical interview scoring

`interview-score-v3` is the sole owner of the final interview-score arithmetic. The AI/backend owns
answer-quality evaluation; speech and visual analyzers own raw measurements; this folder normalizes
those measurements, excludes unavailable values, renormalizes available weights, and records every
effective contribution. AI-generated report prose cannot change deterministic scores.

Answer content always remains dominant. Text uses 100% answer quality, voice uses 75% answer quality
and 25% speech delivery, and video uses 65% answer quality, 20% speech delivery, and 15% visual
presentation. A final candidate-performance score is not produced without measurable answer
quality. Skipped questions and failed evaluations are excluded rather than converted to zero.

Integrity events such as no face, multiple faces, pauses, camera errors, and cancellation are stored
separately and are not performance-score inputs. Face absence is not penalized again after it has
already reduced measurable visual availability. Look-away belongs to camera engagement; silence
belongs to answer flow; background noise belongs to audio clarity; overlapping raw signals do not
create independent duplicate penalties.

Unavailable internal metrics are removed and the remaining weights within their category are
renormalized. No hands visible is not applicable, not a zero. Visual measurements remain a small,
coaching-first influence. Audio hardware quality has only the configured audio-clarity share of the
speech category.

These metrics must not be used to infer confidence, honesty, anxiety, intelligence, personality,
emotion, disability, medical condition, or hireability. Accent and dialect are not scored. Browser
transcription errors can affect pace and filler measurements; camera angle, lighting, mobility, and
assistive movement can affect visual measurements.
