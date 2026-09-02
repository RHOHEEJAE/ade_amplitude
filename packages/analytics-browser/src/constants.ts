import { IdentityStorageType, ServerZoneType } from '@amplitude/analytics-core';

export const DEFAULT_EVENT_PREFIX = '[Amplitude]';

export const DEFAULT_PAGE_VIEW_EVENT = 'ade_page_viewed';
export const DEFAULT_FORM_START_EVENT = 'ade_form_started';
export const DEFAULT_FORM_SUBMIT_EVENT = 'ade_form_submitted';
export const DEFAULT_FILE_DOWNLOAD_EVENT = 'ade_file_downloaded';
export const DEFAULT_SESSION_START_EVENT = 'session_start';
export const DEFAULT_SESSION_END_EVENT = 'session_end';

export const FILE_EXTENSION = 'file_extension';
export const FILE_NAME = 'file_name';
export const LINK_ID = 'link_id';
export const LINK_TEXT = 'link_text';
export const LINK_URL = 'link_url';

export const FORM_ID = 'form_id';
export const FORM_NAME = 'form_name';
export const FORM_DESTINATION = 'form_destination';

export const DEFAULT_IDENTITY_STORAGE: IdentityStorageType = 'cookie';
export const DEFAULT_SERVER_ZONE: ServerZoneType = 'US';
