import { BrowserClient, ElementInteractionsOptions, PerformanceTrackingOptions } from '@amplitude/analytics-core';
import { AMPLITUDE_MAIN_THREAD_BLOCK_EVENT } from '../constants';
import { isUrlAllowed } from '../helpers';

const DEFAULT_DURATION_THRESHOLD = 100; // ms
const MEASURE_BUFFER_WINDOW_MS = 10_000;

// LoAF and Long Task types are not yet in TypeScript's built-in DOM types
interface PerformanceScriptTiming extends PerformanceEntry {
  sourceURL: string;
  sourceFunctionName: string;
  // Character offset into the source URL's script where the function was defined.
  // Used downstream for sourcemap resolution. Optional because coverage varies
  // across browsers and entry origins (inline handlers, new Function, etc.).
  sourceCharPosition?: number;
  invokerType: string;
  invoker: string;
}

interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
  renderStart: number;
  styleAndLayoutStart: number;
  blockingDuration: number;
  scripts: PerformanceScriptTiming[];
}

interface TaskAttributionTiming extends PerformanceEntry {
  name: string;
}

interface PerformanceLongTaskTiming extends PerformanceEntry {
  attribution: TaskAttributionTiming[];
}

function getOverlappingMeasures(entry: PerformanceEntry, measures: PerformanceEntry[]): string[] {
  const taskEnd = entry.startTime + entry.duration;
  return measures
    .filter((measure) => measure.startTime < taskEnd && measure.startTime + measure.duration > entry.startTime)
    .map((measure) => measure.name);
}

function buildLoAFProperties(entry: PerformanceLongAnimationFrameTiming, measures: PerformanceEntry[]) {
  const overlappingMeasures = getOverlappingMeasures(entry, measures);
  const scripts = entry.scripts ?? [];

  const scriptURLs = scripts.map((s) => s.sourceURL).filter(Boolean);
  const scriptFunctions = scripts.map((s) => s.sourceFunctionName).filter(Boolean);
  const scriptPositions = scripts
    .map((s) => s.sourceCharPosition)
    .filter((p): p is number => typeof p === 'number' && p >= 0);
  const invokerTypes = scripts.map((s) => s.invokerType).filter(Boolean);
  const invokers = scripts.map((s) => s.invoker).filter(Boolean);

  return {
    'main_thread_block_source': 'long-animation-frame',
    'main_thread_block_duration': entry.duration,
    'main_thread_block_blocking_duration': entry.blockingDuration,
    'main_thread_block_start_time': entry.startTime,
    ...(overlappingMeasures.length > 0 && { 'main_thread_block_measures': overlappingMeasures }),
    'main_thread_block_render_start': entry.renderStart,
    'main_thread_block_style_and_layout_start': entry.styleAndLayoutStart,
    'main_thread_block_script_count': scripts.length,
    ...(scriptURLs.length > 0 && { 'main_thread_block_script_urls': scriptURLs }),
    ...(scriptFunctions.length > 0 && { 'main_thread_block_script_functions': scriptFunctions }),
    ...(scriptPositions.length > 0 && { 'main_thread_block_script_positions': scriptPositions }),
    ...(invokerTypes.length > 0 && { 'main_thread_block_invoker_types': invokerTypes }),
    ...(invokers.length > 0 && { 'main_thread_block_invokers': invokers }),
  };
}

function buildLongTaskProperties(entry: PerformanceLongTaskTiming, measures: PerformanceEntry[]) {
  const overlappingMeasures = getOverlappingMeasures(entry, measures);
  const attribution = entry.attribution ?? [];

  return {
    'main_thread_block_source': 'long-task',
    'main_thread_block_duration': entry.duration,
    'main_thread_block_blocking_duration': entry.duration,
    'main_thread_block_start_time': entry.startTime,
    ...(overlappingMeasures.length > 0 && { 'main_thread_block_measures': overlappingMeasures }),
    ...(attribution.length > 0 && {
      'main_thread_block_attribution': attribution.map((a: TaskAttributionTiming) => a.name),
    }),
  };
}

function getSupportedEntryType(): 'long-animation-frame' | 'longtask' | null {
  /* istanbul ignore next */
  if (typeof PerformanceObserver === 'undefined') return null;
  try {
    const supported = PerformanceObserver.supportedEntryTypes;
    if (supported.includes('long-animation-frame')) return 'long-animation-frame';
    if (supported.includes('longtask')) return 'longtask';
  } catch {
    // ignore
  }
  return null;
}

export function trackMainThreadBlock({
  amplitude,
  options,
  durationThreshold = DEFAULT_DURATION_THRESHOLD,
}: {
  amplitude: BrowserClient;
  options: PerformanceTrackingOptions;
  durationThreshold?: number;
}) {
  const entryType = getSupportedEntryType();

  /* istanbul ignore next */
  if (!entryType) {
    return { unsubscribe: () => void 0 };
  }

  const measures: PerformanceEntry[] = [];

  const measureObserver = new PerformanceObserver((list) => {
    const now = performance.now();
    for (const entry of list.getEntries()) {
      measures.push(entry);
    }
    const cutoff = now - MEASURE_BUFFER_WINDOW_MS;
    while (measures.length > 0 && measures[0].startTime < cutoff) {
      measures.shift();
    }
  });

  try {
    measureObserver.observe({ entryTypes: ['measure'] });
  } catch {
    // measure not supported — continue without it
  }

  const blockObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!isUrlAllowed(options as ElementInteractionsOptions)) {
        return;
      }
      if (entry.duration < durationThreshold) {
        continue;
      }
      const properties =
        entryType === 'long-animation-frame'
          ? buildLoAFProperties(entry as PerformanceLongAnimationFrameTiming, measures)
          : buildLongTaskProperties(entry as PerformanceLongTaskTiming, measures);

      amplitude.track(AMPLITUDE_MAIN_THREAD_BLOCK_EVENT, properties);
    }
  });

  try {
    blockObserver.observe({ entryTypes: [entryType] });
  } catch {
    measureObserver.disconnect();
    return { unsubscribe: () => void 0 };
  }

  return {
    unsubscribe: () => {
      blockObserver.disconnect();
      measureObserver.disconnect();
    },
  };
}
