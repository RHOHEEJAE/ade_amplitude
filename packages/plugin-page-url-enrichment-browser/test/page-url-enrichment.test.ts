import {
  type BrowserClient,
  type BrowserConfig,
  CookieStorage,
  FetchTransport,
  getGlobalScope,
  LogLevel,
  Logger,
  UUID,
} from '@amplitude/analytics-core';
import {
  CURRENT_PAGE_STORAGE_KEY,
  PREVIOUS_PAGE_STORAGE_KEY,
  URL_INFO_STORAGE_KEY,
  isPageUrlEnrichmentEnabled,
  pageUrlEnrichmentPlugin,
} from '../src/page-url-enrichment';
import * as Core from '@amplitude/analytics-core';

// Mock BrowserClient implementation
const createMockBrowserClient = (): jest.Mocked<BrowserClient> => {
  const mockClient = {
    init: jest.fn().mockReturnValue({
      promise: Promise.resolve(),
    }),
    add: jest.fn(),
    remove: jest.fn(),
    track: jest.fn(),
    logEvent: jest.fn(),
    identify: jest.fn(),
    groupIdentify: jest.fn(),
    setGroup: jest.fn(),
    revenue: jest.fn(),
    flush: jest.fn(),
    getUserId: jest.fn(),
    setUserId: jest.fn(),
    getDeviceId: jest.fn(),
    setDeviceId: jest.fn(),
    getSessionId: jest.fn(),
    setSessionId: jest.fn(),
    extendSession: jest.fn(),
    reset: jest.fn(),
    setOptOut: jest.fn(),
    setTransport: jest.fn(),
  } as unknown as jest.Mocked<BrowserClient>;

  // Set up default return values for methods that return promises
  mockClient.track.mockReturnValue({
    promise: Promise.resolve({
      code: 200,
      message: '',
      event: {
        event_type: 'ade_page_viewed',
      },
    }),
  });

  return mockClient;
};

const createConfigurationMock = (): jest.Mocked<BrowserConfig> => {
  return {
    apiKey: UUID(),
    flushIntervalMillis: 0,
    flushMaxRetries: 0,
    flushQueueSize: 0,
    logLevel: LogLevel.None,
    loggerProvider: new Logger(),
    offline: false,
    optOut: false,
    serverUrl: undefined,
    transportProvider: new FetchTransport(),
    useBatch: false,
    cookieOptions: {
      domain: '.amplitude.com',
      expiration: 365,
      sameSite: 'Lax',
      secure: false,
      upgrade: true,
    },
    cookieStorage: new CookieStorage(),
    sessionTimeout: 30 * 60 * 1000,
    trackingOptions: {
      ipAddress: true,
      language: true,
      platform: true,
    },
    pageCounter: 0,
  } as unknown as jest.Mocked<BrowserConfig>;
};

describe('pageUrlEnrichmentPlugin', () => {
  let mockConfig: BrowserConfig = createConfigurationMock();
  let mockAmplitude = createMockBrowserClient();
  const plugin = pageUrlEnrichmentPlugin();

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      value: {
        hostname: '',
        href: '',
        pathname: '',
        search: '',
      },
      writable: true,
    });
  });

  beforeEach(() => {
    mockAmplitude = createMockBrowserClient();
    mockConfig = createConfigurationMock();

    (window.location as any) = {
      hostname: '',
      href: '',
      pathname: '',
      search: '',
    };
  });

  afterEach(async () => {
    await plugin.teardown?.();
    window.sessionStorage.setItem('AMP_URL_INFO', '{}');
    // Reset document.referrer so tests that set it can't leak into later tests;
    // setup()'s external-origin shortcut depends on this value.
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    jest.restoreAllMocks();
  });

  describe('setup', () => {
    test('should track page changes if we move to a new page', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);
      const sessionStorage = getGlobalScope()?.sessionStorage;
      const history = getGlobalScope()?.history;

      // test falsy location href
      history?.pushState(undefined, '');
      const falsyUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: '',
        [PREVIOUS_PAGE_STORAGE_KEY]: '',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const storedFalsyUrlInfo = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(storedFalsyUrlInfo)).toStrictEqual(falsyUrlInfo);

      // move to first url
      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      history?.pushState(undefined, firstUrl.href);
      const firstUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
        [PREVIOUS_PAGE_STORAGE_KEY]: '',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const storedFirstUrlInfo = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(storedFirstUrlInfo)).toStrictEqual(firstUrlInfo);

      // move to second url
      const secondUrl = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(secondUrl);
      history?.pushState(undefined, secondUrl.href);
      const secondUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const storedSecondUrlInfo = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(storedSecondUrlInfo)).toStrictEqual(secondUrlInfo);

      // move to third url
      const thirdUrl = new URL('https://www.example.com/contact');
      mockWindowLocationFromURL(thirdUrl);
      history?.pushState(undefined, thirdUrl.href);
      const thirdUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/contact',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const storedThirdUrlInfo = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(storedThirdUrlInfo)).toStrictEqual(thirdUrlInfo);
    });

    test('should track page changes if we replace state', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);
      const sessionStorage = getGlobalScope()?.sessionStorage;
      const history = getGlobalScope()?.history;

      // move to first url
      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      history?.pushState(undefined, firstUrl.href);
      const firstUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
        [PREVIOUS_PAGE_STORAGE_KEY]: '',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const urlInfoStr = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(urlInfoStr)).toStrictEqual(firstUrlInfo);

      // move to second url
      const secondUrl = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(secondUrl);
      history?.replaceState(undefined, secondUrl.href);
      const secondUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const storedSecondUrlInfo = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(storedSecondUrlInfo)).toStrictEqual(secondUrlInfo);

      // move to third url
      const thirdUrl = new URL('https://www.example.com/contact');
      mockWindowLocationFromURL(thirdUrl);
      history?.pushState(undefined, thirdUrl.href);
      const thirdUrlInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/contact',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
      };
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));
      const storedThirdUrlInfo = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(storedThirdUrlInfo)).toStrictEqual(thirdUrlInfo);
    });
  });

  describe('execute', () => {
    test('should add additional Page URL and Previous Page properties to an event', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      // test falsy location href
      history?.pushState(undefined, '');
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event_1 = await plugin.execute?.({
        event_type: 'test_event_1',
      });

      expect(event_1?.event_properties).toStrictEqual({
        'page_domain': '',
        'page_location': '',
        'page_path': '',
        'page_title': '',
        'page_url': '',
        'previous_page_location': '',
        'previous_page_type': 'direct',
      });

      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      mockDocumentTitle('Home - Example');
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const secondUrl = new URL('https://www.example.com/about?test=param');
      mockWindowLocationFromURL(secondUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, secondUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event_2 = await plugin.execute?.({
        event_type: 'test_event_2',
      });

      expect(event_2?.event_properties).toStrictEqual({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/about?test=param',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.example.com/about',
        'previous_page_location': 'https://www.example.com/home',
        'previous_page_type': 'internal',
      });
    });

    test('should assign external to previous page type for non-matching domains', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.externalexample.com/home');
      mockWindowLocationFromURL(firstUrl);
      mockDocumentTitle('HOME | External Example');
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const secondUrl = new URL('https://www.example.com/about?test=param');
      mockWindowLocationFromURL(secondUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, secondUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await plugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toStrictEqual({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/about?test=param',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.example.com/about',
        'previous_page_location': 'https://www.externalexample.com/home',
        'previous_page_type': 'external',
      });
    });

    test('should assign external to previous page type for subdomains', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.sub.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const secondUrl = new URL('https://www.example.com/about?test=param');
      mockWindowLocationFromURL(secondUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, secondUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await plugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toStrictEqual({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/about?test=param',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.example.com/about',
        'previous_page_location': 'https://www.sub.example.com/home',
        'previous_page_type': 'external',
      });
    });

    test('should assign internal to previous page type for matching domains', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const secondUrl = new URL('https://www.example.com/about?test=param');
      mockWindowLocationFromURL(secondUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, secondUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await plugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toStrictEqual({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/about?test=param',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.example.com/about',
        'previous_page_location': 'https://www.example.com/home',
        'previous_page_type': 'internal',
      });
    });

    test('should assign internal/external to previous page type for based on internal domain match', async () => {
      const plugin = pageUrlEnrichmentPlugin({ internalDomains: ['example.com', 'example.co.uk'] });
      await plugin.setup?.(mockConfig, mockAmplitude);

      // go from example.com to subdomain.test.example.com (internal)
      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const secondUrl = new URL('https://www.subdomain.test.example.com/about?test=param');
      mockWindowLocationFromURL(secondUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, secondUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await plugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toStrictEqual({
        'page_domain': 'www.subdomain.test.example.com',
        'page_location': 'https://www.subdomain.test.example.com/about?test=param',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.subdomain.test.example.com/about',
        'previous_page_location': 'https://www.example.com/home',
        'previous_page_type': 'internal',
      });

      // go from subdomain.test.example.com to example.co.uk (internal)
      const thirdUrl = new URL('https://www.example.co.uk/contact');
      mockWindowLocationFromURL(thirdUrl);
      mockDocumentTitle('Contact - Example');
      window.history.pushState(undefined, thirdUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event2 = await plugin.execute?.({
        event_type: 'test_event_2',
      });

      expect(event2?.event_properties).toStrictEqual({
        'page_domain': 'www.example.co.uk',
        'page_location': 'https://www.example.co.uk/contact',
        'page_path': '/contact',
        'page_title': 'Contact - Example',
        'page_url': 'https://www.example.co.uk/contact',
        'previous_page_location': 'https://www.subdomain.test.example.com/about?test=param',
        'previous_page_type': 'internal',
      });

      // go from example.co.uk to example.org (external)
      const fourthUrl = new URL('https://www.example.org/home');
      mockWindowLocationFromURL(fourthUrl);
      mockDocumentTitle('Home - Example');
      window.history.pushState(undefined, fourthUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event3 = await plugin.execute?.({
        event_type: 'test_event_3',
      });

      expect(event3?.event_properties).toStrictEqual({
        'page_domain': 'www.example.org',
        'page_location': 'https://www.example.org/home',
        'page_path': '/home',
        'page_title': 'Home - Example',
        'page_url': 'https://www.example.org/home',
        'previous_page_location': 'https://www.example.co.uk/contact',
        'previous_page_type': 'external',
      });

      // go from example.org to example.com (external)
      const fifthUrl = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(fifthUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, fifthUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event4 = await plugin.execute?.({
        event_type: 'test_event_4',
      });

      expect(event4?.event_properties).toStrictEqual({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/about',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.example.com/about',
        'previous_page_location': 'https://www.example.org/home',
        'previous_page_type': 'external',
      });
    });

    test('should assign direct to previous page type for unknown missing domains', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/about?test=param');
      mockWindowLocationFromURL(firstUrl);
      mockDocumentTitle('About - Example');
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await plugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toStrictEqual({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/about?test=param',
        'page_path': '/about',
        'page_title': 'About - Example',
        'page_url': 'https://www.example.com/about',
        'previous_page_location': '',
        'previous_page_type': 'direct',
      });
    });

    test('should shift current to previous on setup when stale storage exists (MPA / full-page reload)', async () => {
      // Simulate stale sessionStorage left over from the previous page load,
      // e.g. user clicked an <a href> link triggering a full-page navigation.
      sessionStorage.setItem(
        URL_INFO_STORAGE_KEY,
        JSON.stringify({
          [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
          [PREVIOUS_PAGE_STORAGE_KEY]: 'https://google.com/search',
        }),
      );

      // Same-origin referrer simulates a real <a href> click within the site;
      // the external-origin shortcut in setup() should NOT fire here.
      Object.defineProperty(document, 'referrer', {
        value: 'https://www.example.com/home',
        configurable: true,
      });

      // The new page has now booted; location is the new URL.
      const newUrl = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(newUrl);
      mockDocumentTitle('About - Example');

      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const urlInfoStr = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(urlInfoStr)).toStrictEqual({
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
      });

      // The first event after setup should also report the prior page as the previous location.
      const event = await newPlugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toMatchObject({
        'page_location': 'https://www.example.com/about',
        'previous_page_location': 'https://www.example.com/home',
        'previous_page_type': 'internal',
      });

      await newPlugin.teardown?.();
    });

    test('should not add properties if they already exist', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await plugin.execute?.({
        event_type: 'test_event',
        event_properties: {
          'page_domain': 'www.existingexample.com',
          'page_location': 'https://www.existingexample.com/about?test=param',
          'page_path': '/existingexample',
          'page_title': 'Existing Example',
          'page_url': 'https://www.existingexample.com/about',
        },
      });

      expect(event?.event_properties).toStrictEqual({
        'page_domain': 'www.existingexample.com',
        'page_location': 'https://www.existingexample.com/about?test=param',
        'page_path': '/existingexample',
        'page_title': 'Existing Example',
        'page_url': 'https://www.existingexample.com/about',
        'previous_page_location': '',
        'previous_page_type': 'direct',
      });
    });

    test('should prefer document.referrer over stale storage when arriving from a different origin', async () => {
      // Simulate the round-trip-away case: user was on /home, left to google.com,
      // then arrived back on the site (e.g. by clicking a Google search result
      // pointing at /about). The stored "current" of /home is stale and should NOT
      // be used as the previous page; document.referrer is the truthful answer.
      sessionStorage.setItem(
        URL_INFO_STORAGE_KEY,
        JSON.stringify({
          [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/home',
          [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/landing',
        }),
      );

      Object.defineProperty(document, 'referrer', {
        value: 'https://www.google.com/search?q=example',
        configurable: true,
      });

      const newUrl = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(newUrl);
      mockDocumentTitle('About - Example');

      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const urlInfoStr = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(urlInfoStr)).toStrictEqual({
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.google.com/search?q=example',
      });

      const event = await newPlugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toMatchObject({
        'page_location': 'https://www.example.com/about',
        'previous_page_location': 'https://www.google.com/search?q=example',
        'previous_page_type': 'external',
      });

      await newPlugin.teardown?.();
    });

    test('should keep stored previous page on refresh even when document.referrer is a stale external origin', async () => {
      // Repro of the SPA-refresh bug: user arrived at /landing from Google,
      // pushState-navigated to /about, then hit refresh on /about. Browsers
      // preserve document.referrer (still google.com) across pushState and
      // full-page reloads, so a referrer-hostname-only check would mistakenly
      // re-fire the external-origin branch and clobber the truthful internal
      // previous page (/landing) that pushState had stored.
      sessionStorage.setItem(
        URL_INFO_STORAGE_KEY,
        JSON.stringify({
          [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
          [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/landing',
        }),
      );

      Object.defineProperty(document, 'referrer', {
        value: 'https://www.google.com/search?q=example',
        configurable: true,
      });

      const refreshedUrl = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(refreshedUrl);
      mockDocumentTitle('About - Example');

      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const urlInfoStr = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      expect(JSON.parse(urlInfoStr)).toStrictEqual({
        [CURRENT_PAGE_STORAGE_KEY]: 'https://www.example.com/about',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'https://www.example.com/landing',
      });

      const event = await newPlugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toMatchObject({
        'page_location': 'https://www.example.com/about',
        'previous_page_location': 'https://www.example.com/landing',
        'previous_page_type': 'internal',
      });

      await newPlugin.teardown?.();
    });

    test('should fall back to empty previous page when sessionStorage is wiped mid-session', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const url = new URL('https://www.example.com/about');
      mockWindowLocationFromURL(url);
      mockDocumentTitle('About - Example');

      // Externally wipe AMP_URL_INFO after setup has seeded it. execute() should
      // gracefully degrade to an empty previous page rather than throw.
      sessionStorage.removeItem(URL_INFO_STORAGE_KEY);

      const event = await plugin.execute?.({
        event_type: 'test_event',
      });

      expect(event?.event_properties).toMatchObject({
        'page_location': 'https://www.example.com/about',
        'previous_page_location': '',
        'previous_page_type': 'direct',
      });
    });

    test('should ignore event if it is one of the default event types to be excluded', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);

      const excludedEvent = await plugin.execute?.({
        event_type: '$identify',
      });

      expect(excludedEvent?.event_properties).toStrictEqual(undefined);
    });
  });

  describe('teardown', () => {
    test('should call remove listeners', async () => {
      const removeEventListener = jest.spyOn(window, 'removeEventListener');
      await plugin.setup?.(mockConfig, mockAmplitude);
      await plugin.teardown?.();
      expect(removeEventListener).toHaveBeenCalledTimes(1);
    });

    test('sessionStorage items should be removed', async () => {
      await plugin.setup?.(mockConfig, mockAmplitude);
      const sessionStorage = getGlobalScope()?.sessionStorage;

      const initialURLInfo = {
        [CURRENT_PAGE_STORAGE_KEY]: 'www.example.com/home',
        [PREVIOUS_PAGE_STORAGE_KEY]: 'www.example.com/about',
      };

      sessionStorage?.setItem(URL_INFO_STORAGE_KEY, JSON.stringify(initialURLInfo));
      expect(sessionStorage?.getItem(URL_INFO_STORAGE_KEY)).toStrictEqual(JSON.stringify(initialURLInfo));

      await plugin.teardown?.();
      expect(sessionStorage?.getItem(URL_INFO_STORAGE_KEY)).toStrictEqual(JSON.stringify({}));
    });
  });

  describe('first page load with document.referrer', () => {
    test('should set Previous Page Type to "direct" when no referrer exists', async () => {
      sessionStorage.clear();

      Object.defineProperty(document, 'referrer', {
        value: '',
        configurable: true,
      });

      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/');
      mockWindowLocationFromURL(firstUrl);
      mockDocumentTitle('Home - Example');

      window.history.replaceState(undefined, '');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await newPlugin.execute?.({
        event_type: 'Page View',
      });

      expect(event?.event_properties).toMatchObject({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/',
        'previous_page_location': '',
        'previous_page_type': 'direct',
      });

      const urlInfoStr = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      const urlInfo = JSON.parse(urlInfoStr);
      expect(urlInfo[CURRENT_PAGE_STORAGE_KEY]).toBe('https://www.example.com/');
      expect(urlInfo[PREVIOUS_PAGE_STORAGE_KEY]).toBe('');

      await newPlugin.teardown?.();
    });

    test('should preserve external referrer on first page load', async () => {
      sessionStorage.clear();

      Object.defineProperty(document, 'referrer', {
        value: 'https://google.com/search',
        configurable: true,
      });

      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/');
      mockWindowLocationFromURL(firstUrl);
      mockDocumentTitle('Home - Example');

      window.history.replaceState(undefined, '');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await newPlugin.execute?.({
        event_type: 'Page View',
      });

      expect(event?.event_properties).toMatchObject({
        'page_domain': 'www.example.com',
        'page_location': 'https://www.example.com/',
        'previous_page_location': 'https://google.com/search',
        'previous_page_type': 'external',
      });

      const urlInfoStr = sessionStorage?.getItem(URL_INFO_STORAGE_KEY) || '';
      const urlInfo = JSON.parse(urlInfoStr);
      expect(urlInfo[CURRENT_PAGE_STORAGE_KEY]).toBe('https://www.example.com/');
      expect(urlInfo[PREVIOUS_PAGE_STORAGE_KEY]).toBe('https://google.com/search');

      await newPlugin.teardown?.();
    });

    test('should handle history events before first event is tracked', async () => {
      sessionStorage.clear();

      Object.defineProperty(document, 'referrer', {
        value: '',
        configurable: true,
      });

      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);

      window.history.pushState(undefined, '');
      await new Promise((resolve) => setTimeout(resolve, 0));

      window.history.replaceState(undefined, '');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const event = await newPlugin.execute?.({
        event_type: 'Page View',
      });

      expect(event?.event_properties).toMatchObject({
        'previous_page_location': '',
        'previous_page_type': 'direct',
      });

      await newPlugin.teardown?.();
    });
  });

  describe('others', () => {
    test('should handle when globalScope is not defined', async () => {
      jest.spyOn(Core, 'getGlobalScope').mockReturnValue(undefined);
      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);
      await newPlugin.teardown?.();
      expect(Core.getGlobalScope).toHaveBeenCalledTimes(1);
    });
    test('should handle sessionStorage throwing (e.g. sandboxed iframe) and continue without session storage', async () => {
      const logger = new Logger();
      const debugSpy = jest.spyOn(logger, 'debug');
      const configWithLogger = { ...mockConfig, loggerProvider: logger };

      // Build scope without spreading window so sessionStorage getter is only invoked when plugin accesses it
      const scopeWithThrowingSessionStorage = {
        addEventListener: window.addEventListener.bind(window),
        removeEventListener: window.removeEventListener.bind(window),
        history: window.history,
        get sessionStorage() {
          throw new DOMException('The operation is insecure', 'SecurityError');
        },
      };
      jest
        .spyOn(Core, 'getGlobalScope')
        .mockReturnValue(scopeWithThrowingSessionStorage as unknown as typeof globalThis);

      const newPlugin = pageUrlEnrichmentPlugin();
      await expect(newPlugin.setup?.(configWithLogger, mockAmplitude)).resolves.not.toThrow();
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('sessionStorage is not available in this environment'),
      );

      await newPlugin.teardown?.();
    });

    test('should handle when sessionStorage is not defined', async () => {
      const actual = jest.requireActual('@amplitude/analytics-core') as unknown as typeof Core;
      jest.spyOn(Core, 'getGlobalScope').mockReturnValue({
        ...actual.getGlobalScope(),
        sessionStorage: undefined,
      } as unknown as typeof globalThis);
      const newPlugin = pageUrlEnrichmentPlugin();
      await newPlugin.setup?.(mockConfig, mockAmplitude);

      const firstUrl = new URL('https://www.example.com/home');
      mockWindowLocationFromURL(firstUrl);
      mockDocumentTitle('Home - Example');
      window.history.pushState(undefined, firstUrl.href);
      // block event loop so that the sessionStorage is updated since pushState is async
      await new Promise((resolve) => setTimeout(resolve, 0));

      await newPlugin.execute?.({
        event_type: 'test_event',
      });
      await newPlugin.teardown?.();
      expect(Core.getGlobalScope).toHaveBeenCalledTimes(2);
    });
  });
});

describe('isPageUrlEnrichmentEnabled', () => {
  test('should return true with true parameter', () => {
    expect(isPageUrlEnrichmentEnabled(true)).toBe(true);
  });

  test('should return false with undefined parameter', () => {
    expect(isPageUrlEnrichmentEnabled(undefined)).toBe(false);
  });

  test('should return false with false parameter', () => {
    expect(isPageUrlEnrichmentEnabled(false)).toBe(false);
  });

  test('should return true with object parameter set to true', () => {
    expect(
      isPageUrlEnrichmentEnabled({
        pageUrlEnrichment: true,
      }),
    ).toBe(true);
  });

  test('should return false with object parameter set to false', () => {
    expect(
      isPageUrlEnrichmentEnabled({
        pageUrlEnrichment: false,
      }),
    ).toBe(false);
  });

  test('should return false with object parameter undefined', () => {
    expect(
      isPageUrlEnrichmentEnabled({
        pageUrlEnrichment: undefined,
      }),
    ).toBe(false);
  });
});

const mockWindowLocationFromURL = (url: URL) => {
  window.location.href = url.toString();
  window.location.search = url.search;
  window.location.hostname = url.hostname;
  window.location.pathname = url.pathname;
};

const mockDocumentTitle = (title: string) => {
  document.title = title;
};
