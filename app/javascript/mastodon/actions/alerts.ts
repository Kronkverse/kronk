import { defineMessages } from 'react-intl';

import { createAction } from '@reduxjs/toolkit';

import { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

import type { Alert } from 'mastodon/models/alert';

interface ApiErrorResponse {
  error?: string;
}

const messages = defineMessages({
  unexpectedTitle: { id: 'alert.unexpected.title', defaultMessage: 'Oops!' },
  unexpectedMessage: {
    id: 'alert.unexpected.message',
    defaultMessage: 'An unexpected error occurred.',
  },
  rateLimitedTitle: {
    id: 'alert.rate_limited.title',
    defaultMessage: 'Rate limited',
  },
  rateLimitedMessage: {
    id: 'alert.rate_limited.message',
    defaultMessage: 'Please retry after {retry_time, time, medium}.',
  },
  serverTitle: {
    id: 'alert.server_error.title',
    defaultMessage: 'Kronk is having a moment',
  },
  serverMessage: {
    id: 'alert.server_error.message',
    defaultMessage: 'The server didn’t answer. Try again shortly.',
  },
});

export const dismissAlert = createAction<{ key: number }>('alerts/dismiss');

export const clearAlerts = createAction('alerts/clear');

export const showAlert = createAction<Omit<Alert, 'key'>>('alerts/show');

const ignoreAlert = createAction('alerts/ignore');

export const showAlertForError = (error: unknown, skipNotFound = false) => {
  if (error instanceof AxiosError && error.response) {
    const { status, statusText, headers } = error.response;
    const { data } = error.response as AxiosResponse<ApiErrorResponse>;

    // Skip these errors as they are reflected in the UI
    if (skipNotFound && (status === 404 || status === 410)) {
      return ignoreAlert();
    }

    // Rate limit errors
    if (status === 429 && headers['x-ratelimit-reset']) {
      return showAlert({
        title: messages.rateLimitedTitle,
        message: messages.rateLimitedMessage,
        values: {
          retry_time: new Date(headers['x-ratelimit-reset'] as string),
        },
        error: true,
      });
    }

    // Gateway and server failures (502 while the server restarts, etc.)
    // carry no useful body; a bare status code isn't something people read.
    if (status >= 500 && !data.error) {
      return showAlert({
        title: messages.serverTitle,
        message: messages.serverMessage,
        error: true,
      });
    }

    return showAlert({
      title: `${status}`,
      message: data.error ?? (statusText || messages.unexpectedMessage),
      error: true,
    });
  }

  // An aborted request, e.g. due to reloading the browser window, is not really an error
  if (error instanceof AxiosError && error.code === AxiosError.ECONNABORTED) {
    return ignoreAlert();
  }

  console.error(error);

  return showAlert({
    title: messages.unexpectedTitle,
    message: messages.unexpectedMessage,
    error: true,
  });
};
