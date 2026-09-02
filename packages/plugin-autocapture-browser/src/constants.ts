export const PLUGIN_NAME = '@amplitude/plugin-autocapture-browser';
export const FRUSTRATION_PLUGIN_NAME = '@amplitude/plugin-frustration-browser';
export const PERFORMANCE_PLUGIN_NAME = '@amplitude/plugin-performance-browser';

export const AMPLITUDE_ELEMENT_CLICKED_EVENT = 'ade_element_clicked';
export const AMPLITUDE_ELEMENT_DEAD_CLICKED_EVENT = 'ade_dead_click';
export const AMPLITUDE_ELEMENT_RAGE_CLICKED_EVENT = 'ade_rage_click';
export const AMPLITUDE_ELEMENT_ERROR_CLICKED_EVENT = 'ade_error_click';
export const AMPLITUDE_ELEMENT_CHANGED_EVENT = 'ade_element_changed';
export const AMPLITUDE_PAGE_SCROLLED_EVENT = 'ade_page_scrolled';
export const AMPLITUDE_THRASHED_CURSOR_EVENT = 'ade_thrashed_cursor';
export const AMPLITUDE_MAIN_THREAD_BLOCK_EVENT = 'ade_main_thread_block';

export const AMPLITUDE_EVENT_PROP_ELEMENT_ID = 'element_id';
export const AMPLITUDE_EVENT_PROP_ELEMENT_CLASS = 'element_class';
export const AMPLITUDE_EVENT_PROP_ELEMENT_TAG = 'element_tag';
export const AMPLITUDE_EVENT_PROP_ELEMENT_TEXT = 'element_text';
export const AMPLITUDE_EVENT_PROP_ELEMENT_HIERARCHY = 'element_hierarchy';
export const AMPLITUDE_EVENT_PROP_ELEMENT_HREF = 'element_href';
export const AMPLITUDE_EVENT_PROP_ELEMENT_POSITION_LEFT = 'element_position_left';
export const AMPLITUDE_EVENT_PROP_ELEMENT_POSITION_TOP = 'element_position_top';
export const AMPLITUDE_EVENT_PROP_ELEMENT_ARIA_LABEL = 'element_aria_label';
export const AMPLITUDE_EVENT_PROP_ELEMENT_ATTRIBUTES = 'element_attributes';
export const AMPLITUDE_EVENT_PROP_ELEMENT_PATH = 'element_path';

export const AMPLITUDE_EVENT_PROP_ELEMENT_PARENT_LABEL = 'element_parent_label';
export const AMPLITUDE_EVENT_PROP_PAGE_URL = 'page_url';
export const AMPLITUDE_EVENT_PROP_PAGE_TITLE = 'page_title';
export const AMPLITUDE_EVENT_PROP_VIEWPORT_HEIGHT = 'viewport_height';
export const AMPLITUDE_EVENT_PROP_VIEWPORT_WIDTH = 'viewport_width';
export const AMPLITUDE_EVENT_PROP_MAX_PAGE_X = 'max_page_x';
export const AMPLITUDE_EVENT_PROP_MAX_PAGE_Y = 'max_page_y';

export const AMPLITUDE_EVENT_PROP_PAGE_VIEW_ID = 'page_view_id';

// Origin constants are now shared via analytics-core; re-export for backwards compatibility
export {
  AMPLITUDE_ORIGIN,
  AMPLITUDE_ORIGIN_EU,
  AMPLITUDE_ORIGIN_STAGING,
  AMPLITUDE_ORIGINS_MAP,
  AMPLITUDE_BACKGROUND_CAPTURE_SCRIPT_URL,
} from '@amplitude/analytics-core';

export const AMPLITUDE_VISUAL_TAGGING_SELECTOR_SCRIPT_URL =
  'https://cdn.amplitude.com/libs/visual-tagging-selector-1.0.0-alpha.js.gz';
// This is the class name used by the visual tagging selector to highlight the selected element.
// Should not use this class in the selector.
export const AMPLITUDE_VISUAL_TAGGING_HIGHLIGHT_CLASS = 'amp-visual-tagging-selector-highlight';

// Data attribute for specifying which attributes should be redacted from autocapture
export const DATA_AMP_MASK_ATTRIBUTES = 'data-amp-mask-attributes';

export const MAX_MASK_TEXT_PATTERNS = 25;

export const MAX_ATTRIBUTE_LENGTH = 128;

// The key for the page view object in sessionStorage
export const PAGE_VIEW_SESSION_STORAGE_KEY = 'AMP_PAGE_VIEW';

export const MAX_ELEMENT_EXPOSED_STR_LENGTH = 18_000;
