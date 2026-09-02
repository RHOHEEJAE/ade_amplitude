/* eslint-disable @typescript-eslint/unbound-method */
import { trackMainThreadBlock } from '../../src/autocapture/track-long-task';
import { createMockBrowserClient } from '../mock-browser-client';
import { AMPLITUDE_MAIN_THREAD_BLOCK_EVENT } from '../../src/constants';

type PerformanceObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void;

class MockPerformanceObserver {
  static callback: PerformanceObserverCallback;
  static instances: MockPerformanceObserver[] = [];
  static supportedEntryTypes: string[] = ['long-animation-frame'];

  callback: PerformanceObserverCallback;
  disconnected = false;
  observed: { entryTypes: string[] } | null = null;

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
    MockPerformanceObserver.instances.push(this);
  }

  observe(options: { entryTypes: string[] }) {
    this.observed = options;
  }

  disconnect() {
    this.disconnected = true;
  }

  fire(entries: Partial<PerformanceEntry>[]) {
    this.callback({ getEntries: () => entries as PerformanceEntry[] });
  }
}

function getMeasureObserver() {
  return MockPerformanceObserver.instances.find((i) => i.observed?.entryTypes.includes('measure'))!;
}

function getBlockObserver() {
  return MockPerformanceObserver.instances.find(
    (i) => i.observed?.entryTypes.includes('long-animation-frame') || i.observed?.entryTypes.includes('longtask'),
  )!;
}

describe('trackMainThreadBlock', () => {
  let originalPerformanceObserver: typeof PerformanceObserver;
  let amplitude: ReturnType<typeof createMockBrowserClient>;

  beforeEach(() => {
    MockPerformanceObserver.instances = [];
    MockPerformanceObserver.supportedEntryTypes = ['long-animation-frame'];
    originalPerformanceObserver = global.PerformanceObserver;
    (global as any).PerformanceObserver = MockPerformanceObserver;
    amplitude = createMockBrowserClient();
  });

  afterEach(() => {
    global.PerformanceObserver = originalPerformanceObserver;
  });

  describe('long-animation-frame entry type', () => {
    it('should track LoAF event with script metadata', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [
            { sourceURL: 'app.js', sourceFunctionName: 'onClick', invokerType: 'event-listener', invoker: 'click' },
          ],
        } as any,
      ]);

      expect(amplitude.track).toHaveBeenCalledWith(AMPLITUDE_MAIN_THREAD_BLOCK_EVENT, {
        'main_thread_block_source': 'long-animation-frame',
        'main_thread_block_duration': 150,
        'main_thread_block_blocking_duration': 120,
        'main_thread_block_start_time': 1000,
        'main_thread_block_render_start': 1050,
        'main_thread_block_style_and_layout_start': 1080,
        'main_thread_block_script_count': 1,
        'main_thread_block_script_urls': ['app.js'],
        'main_thread_block_script_functions': ['onClick'],
        'main_thread_block_invoker_types': ['event-listener'],
        'main_thread_block_invokers': ['click'],
      });
    });

    it('should omit empty script fields', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [{ sourceURL: '', sourceFunctionName: '', invokerType: '', invoker: '' }],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_script_urls']).toBeUndefined();
      expect(call['main_thread_block_script_functions']).toBeUndefined();
      expect(call['main_thread_block_script_positions']).toBeUndefined();
      expect(call['main_thread_block_invoker_types']).toBeUndefined();
      expect(call['main_thread_block_invokers']).toBeUndefined();
    });

    it('should include script positions when sourceCharPosition is present', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [
            {
              sourceURL: 'app.js',
              sourceFunctionName: 'onClick',
              sourceCharPosition: 1234,
              invokerType: 'event-listener',
              invoker: 'click',
            },
            {
              sourceURL: 'vendor.js',
              sourceFunctionName: 'handle',
              // 0 is a valid character position and must not be filtered out
              sourceCharPosition: 0,
              invokerType: 'event-listener',
              invoker: 'scroll',
            },
          ],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_script_positions']).toEqual([1234, 0]);
    });

    it('should omit script positions when sourceCharPosition is missing on all scripts', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [
            { sourceURL: 'app.js', sourceFunctionName: 'onClick', invokerType: 'event-listener', invoker: 'click' },
          ],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_script_positions']).toBeUndefined();
    });

    it('should filter out -1 sentinel values from sourceCharPosition', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [
            {
              sourceURL: 'app.js',
              sourceFunctionName: 'onClick',
              sourceCharPosition: 42,
              invokerType: 'event-listener',
              invoker: 'click',
            },
            {
              sourceURL: 'vendor.js',
              sourceFunctionName: 'handle',
              sourceCharPosition: -1,
              invokerType: 'event-listener',
              invoker: 'scroll',
            },
          ],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_script_positions']).toEqual([42]);
    });

    it('should include overlapping measures', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      // Fire a measure entry first
      getMeasureObserver().fire([{ name: 'my-measure', startTime: 900, duration: 200 } as any]);

      // Fire a LoAF entry that overlaps with the measure
      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_measures']).toEqual(['my-measure']);
    });

    it('should not include non-overlapping measures', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      // Measure that ends before the block starts
      getMeasureObserver().fire([{ name: 'old-measure', startTime: 0, duration: 500 } as any]);

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_measures']).toBeUndefined();
    });

    it('should not track when duration is below threshold', () => {
      trackMainThreadBlock({ amplitude, options: {}, durationThreshold: 200 });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [],
        } as any,
      ]);

      expect(amplitude.track).not.toHaveBeenCalled();
    });

    it('should not track when URL is not allowed', () => {
      trackMainThreadBlock({
        amplitude,
        options: { pageUrlAllowlist: ['https://allowed.com'] } as any,
      });

      // jsdom default URL is about:blank, not in allowlist
      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [],
        } as any,
      ]);

      expect(amplitude.track).not.toHaveBeenCalled();
    });

    it('should handle no scripts property (undefined scripts)', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: undefined,
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_script_count']).toBe(0);
    });
  });

  describe('longtask entry type', () => {
    beforeEach(() => {
      MockPerformanceObserver.supportedEntryTypes = ['longtask'];
    });

    it('should track longtask event with attribution', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          attribution: [{ name: 'same-origin' }],
        } as any,
      ]);

      expect(amplitude.track).toHaveBeenCalledWith(AMPLITUDE_MAIN_THREAD_BLOCK_EVENT, {
        'main_thread_block_source': 'long-task',
        'main_thread_block_duration': 150,
        'main_thread_block_blocking_duration': 150,
        'main_thread_block_start_time': 1000,
        'main_thread_block_attribution': ['same-origin'],
      });
    });

    it('should omit attribution when empty', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([{ duration: 150, startTime: 1000, attribution: [] } as any]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_attribution']).toBeUndefined();
    });

    it('should handle undefined attribution', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([{ duration: 150, startTime: 1000, attribution: undefined } as any]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_attribution']).toBeUndefined();
    });

    it('should include overlapping measures for longtask entries', () => {
      trackMainThreadBlock({ amplitude, options: {} });

      getMeasureObserver().fire([{ name: 'my-measure', startTime: 900, duration: 200 } as any]);

      getBlockObserver().fire([{ duration: 150, startTime: 1000, attribution: [] } as any]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_measures']).toEqual(['my-measure']);
    });
  });

  describe('measure buffer pruning', () => {
    it('should prune stale measures older than the buffer window', () => {
      jest.spyOn(performance, 'now').mockReturnValue(20_000);
      trackMainThreadBlock({ amplitude, options: {} });

      // Stale measure: startTime=0 < now(20000) - 10000 = 10000
      getMeasureObserver().fire([{ name: 'stale', startTime: 0, duration: 100 } as any]);

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 15_000,
          blockingDuration: 120,
          renderStart: 15_050,
          styleAndLayoutStart: 15_080,
          scripts: [],
        } as any,
      ]);

      const call = (amplitude.track as jest.Mock).mock.calls[0][1];
      expect(call['main_thread_block_measures']).toBeUndefined();
      jest.restoreAllMocks();
    });
  });

  describe('unsupported entry types', () => {
    it('should return no-op unsubscribe when neither long-animation-frame nor longtask is supported', () => {
      MockPerformanceObserver.supportedEntryTypes = [];
      const { unsubscribe } = trackMainThreadBlock({ amplitude, options: {} });
      // Should not have created any observers
      expect(MockPerformanceObserver.instances.length).toBe(0);
      // unsubscribe is the istanbul-ignored no-op
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('measureObserver.observe failure', () => {
    it('should continue without measures when measure observation throws', () => {
      const originalObserve = MockPerformanceObserver.prototype.observe;
      let callCount = 0;
      MockPerformanceObserver.prototype.observe = function (opts: { entryTypes: string[] }) {
        callCount++;
        if (callCount === 1 && opts.entryTypes.includes('measure')) {
          throw new Error('measure not supported');
        }
        originalObserve.call(this, opts);
      };

      trackMainThreadBlock({ amplitude, options: {} });

      getBlockObserver().fire([
        {
          duration: 150,
          startTime: 1000,
          blockingDuration: 120,
          renderStart: 1050,
          styleAndLayoutStart: 1080,
          scripts: [],
        } as any,
      ]);

      expect(amplitude.track).toHaveBeenCalledTimes(1);
      MockPerformanceObserver.prototype.observe = originalObserve;
    });
  });

  describe('blockObserver.observe failure', () => {
    it('should disconnect measureObserver and return no-op unsubscribe when block observation throws', () => {
      const originalObserve = MockPerformanceObserver.prototype.observe;
      let callCount = 0;
      MockPerformanceObserver.prototype.observe = function (opts: { entryTypes: string[] }) {
        callCount++;
        if (callCount === 2) {
          throw new Error('longtask not supported');
        }
        originalObserve.call(this, opts);
      };

      const { unsubscribe } = trackMainThreadBlock({ amplitude, options: {} });
      unsubscribe();

      expect(amplitude.track).not.toHaveBeenCalled();
      MockPerformanceObserver.prototype.observe = originalObserve;
    });
  });

  describe('unsubscribe', () => {
    it('should disconnect both observers on unsubscribe', () => {
      const { unsubscribe } = trackMainThreadBlock({ amplitude, options: {} });
      unsubscribe();

      MockPerformanceObserver.instances.forEach((i) => {
        expect(i.disconnected).toBe(true);
      });
    });
  });
});
