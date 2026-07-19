import { SPEECH_DELIVERY_THRESHOLDS as T } from "../audio/audioThresholds";
import type { SpeakingPaceState } from "../audio/audioTypes";

const FILLERS: Array<[string, RegExp]> = [
  ["um", /\bum+\b/gi],
  ["uh", /\buh+\b/gi],
  ["erm", /\berm+\b/gi],
  ["hmm", /\bhmm+\b/gi],
  ["you know", /\byou\s+know\b/gi],
  ["I mean", /\bi\s+mean\b/gi],
  ["sort of", /\bsort\s+of\b/gi],
  ["kind of", /\bkind\s+of\b/gi],
  ["basically", /\bbasically\b/gi],
  ["literally", /\bliterally\b/gi],
];

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function analyzeFillers(text: string) {
  const frequencies = FILLERS.map(
    ([label, pattern]) => [label, text.match(pattern)?.length || 0] as const,
  )
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const fillerWordCount = frequencies.reduce((total, [, count]) => total + count, 0);
  const words = countWords(text);
  return {
    fillerWordCount,
    fillerWordsPer100Words: words > 0 ? (fillerWordCount / words) * 100 : 0,
    mostFrequentFillers: frequencies.slice(0, 3).map(([label]) => label),
  };
}

export function calculateActiveSpeechPace(wordCount: number, activeSpeechMs: number) {
  if (
    wordCount <= 0 ||
    activeSpeechMs <= 0 ||
    (wordCount < T.minimumWordsForPace && activeSpeechMs < T.minimumActiveSpeechMsForPace)
  )
    return { wpm: 0, state: "not_measurable" as SpeakingPaceState };
  const wpm = activeSpeechMs > 0 ? Math.round(wordCount / (activeSpeechMs / 60_000)) : 0;
  return {
    wpm,
    state:
      wpm < T.lowPaceWpm
        ? ("slow" as const)
        : wpm > T.highPaceWpm
          ? ("fast" as const)
          : ("balanced" as const),
  };
}
