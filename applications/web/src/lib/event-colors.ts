import type { Event } from '@sideline/domain';

interface EventColorSet {
  bg: string;
  text: string;
  dot: string;
  border: string;
}

const TRAINING_PALETTE: ReadonlyArray<EventColorSet> = [
  {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    dot: 'bg-blue-500',
    border: 'border-blue-300 dark:border-blue-700',
  },
  {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-200',
    dot: 'bg-emerald-500',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
  {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    dot: 'bg-purple-500',
    border: 'border-purple-300 dark:border-purple-700',
  },
  {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-200',
    dot: 'bg-amber-500',
    border: 'border-amber-300 dark:border-amber-700',
  },
  {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
    dot: 'bg-cyan-500',
    border: 'border-cyan-300 dark:border-cyan-700',
  },
  {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-800 dark:text-rose-200',
    dot: 'bg-rose-500',
    border: 'border-rose-300 dark:border-rose-700',
  },
  {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-800 dark:text-indigo-200',
    dot: 'bg-indigo-500',
    border: 'border-indigo-300 dark:border-indigo-700',
  },
  {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    text: 'text-teal-800 dark:text-teal-200',
    dot: 'bg-teal-500',
    border: 'border-teal-300 dark:border-teal-700',
  },
];

const EVENT_TYPE_COLORS: Record<Event.EventType, EventColorSet> = {
  training: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    dot: 'bg-blue-500',
    border: 'border-blue-300 dark:border-blue-700',
  },
  match: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    dot: 'bg-red-500',
    border: 'border-red-300 dark:border-red-700',
  },
  tournament: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    dot: 'bg-orange-500',
    border: 'border-orange-300 dark:border-orange-700',
  },
  meeting: {
    bg: 'bg-slate-100 dark:bg-slate-900/30',
    text: 'text-slate-800 dark:text-slate-200',
    dot: 'bg-slate-500',
    border: 'border-slate-300 dark:border-slate-700',
  },
  social: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-800 dark:text-pink-200',
    dot: 'bg-pink-500',
    border: 'border-pink-300 dark:border-pink-700',
  },
  other: {
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    text: 'text-gray-800 dark:text-gray-200',
    dot: 'bg-gray-500',
    border: 'border-gray-300 dark:border-gray-700',
  },
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export type TrainingTypeColorMap = ReadonlyMap<string, EventColorSet>;

export function buildTrainingTypeColorMap(names: ReadonlyArray<string>): TrainingTypeColorMap {
  const sorted = [...names].sort();
  const map = new Map<string, EventColorSet>();
  for (const name of sorted) {
    const index = hashString(name) % TRAINING_PALETTE.length;
    map.set(name, TRAINING_PALETTE[index]);
  }
  return map;
}

export function getEventColor(
  eventType: Event.EventType,
  trainingTypeName: string | null,
  colorMap: TrainingTypeColorMap,
): EventColorSet {
  if (eventType === 'training' && trainingTypeName !== null) {
    const mapped = colorMap.get(trainingTypeName);
    if (mapped) return mapped;
  }
  return EVENT_TYPE_COLORS[eventType];
}
