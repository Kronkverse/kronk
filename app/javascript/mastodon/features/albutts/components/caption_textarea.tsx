import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { apiRequestGet } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

// A drop-in <textarea> replacement for Albutts photo captions that
// autocompletes `@user` while typing — the same affordance the main
// Mastodon composer offers, but with a self-contained local state so
// multiple captions can be edited on one page without a shared redux
// slice fighting over which token is "active".
//
// Hashtag autocomplete is deliberately NOT wired up: we don't
// encourage `#` in caption UX. The tagging architecture (server-side
// extraction / indexing) can still exist behind the scenes without a
// user-facing surface here.

interface Suggestion {
  kind: 'account';
  account: ApiAccountJSON;
}

const MIN_QUERY = 1; // one character after the `@` before we search

// Find the token under the caret. Returns `[startIndex, token]` or
// `[null, null]` when the caret is not inside an `@` word.
const tokenAtCaret = (
  value: string,
  caret: number,
): [number | null, string | null] => {
  if (caret === 0) return [null, null];
  const left = value.slice(0, caret).search(/@[^\s]*$/);
  if (left < 0) return [null, null];
  const right = value.slice(caret).search(/\s/);
  const word = right < 0 ? value.slice(left) : value.slice(left, caret + right);
  if (word.length < MIN_QUERY + 1) return [null, null];
  return [left, word];
};

export interface CaptionTextareaHandle {
  focus: () => void;
}

interface CaptionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  maxLength?: number;
  // Optional data key so container components can key off the
  // textarea's identity when routing change events without a bound
  // callback per item.
  'data-key'?: string;
}

export const CaptionTextarea = forwardRef<
  CaptionTextareaHandle,
  CaptionTextareaProps
>(function CaptionTextarea(
  {
    value,
    onChange,
    placeholder,
    disabled,
    className,
    rows = 2,
    maxLength,
    'data-key': dataKey,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tokenStart, setTokenStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
    }),
    [],
  );

  const closeSuggestions = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSuggestions([]);
    setTokenStart(null);
    setSelectedIndex(0);
  }, []);

  // Fetch account suggestions for the token under the caret. Hits
  // the same endpoint the main compose slice uses, so it shares the
  // server's throttle and cache.
  const fetchForToken = useCallback(async (token: string, start: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await apiRequestGet<ApiAccountJSON[]>('v1/accounts/search', {
        q: token.slice(1),
        resolve: false,
        limit: 6,
      });
      if (controller.signal.aborted) return;
      setSuggestions(data.map((account) => ({ kind: 'account', account })));
      setTokenStart(start);
      setSelectedIndex(0);
    } catch (err) {
      if ((err as { name?: string }).name !== 'CanceledError') {
        // Silent failure — a broken suggestion query shouldn't nuke
        // the user's caption.
        console.warn('[albutts] suggestion fetch failed', err);
      }
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = maxLength
        ? e.currentTarget.value.slice(0, maxLength)
        : e.currentTarget.value;
      onChange(next);

      const caret = e.currentTarget.selectionStart;
      const [start, token] = tokenAtCaret(next, caret);
      if (start === null || token === null) {
        closeSuggestions();
        return;
      }
      void fetchForToken(token, start);
    },
    [closeSuggestions, fetchForToken, maxLength, onChange],
  );

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      if (tokenStart === null || !textareaRef.current) return;
      const caret = textareaRef.current.selectionStart;
      const before = value.slice(0, tokenStart);
      const after = value.slice(caret);
      const insertion = `@${suggestion.account.acct}`;
      const nextValue = `${before}${insertion} ${after}`;
      onChange(maxLength ? nextValue.slice(0, maxLength) : nextValue);
      closeSuggestions();
      // Restore caret just after the inserted token + space.
      const nextCaret = before.length + insertion.length + 1;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [closeSuggestions, maxLength, onChange, tokenStart, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const picked = suggestions[selectedIndex];
        if (picked) {
          e.preventDefault();
          applySuggestion(picked);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSuggestions();
      }
    },
    [applySuggestion, closeSuggestions, selectedIndex, suggestions],
  );

  const handleBlur = useCallback(() => {
    // Delay so a click on a suggestion still fires before we tear the
    // dropdown down.
    setTimeout(closeSuggestions, 120);
  }, [closeSuggestions]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return (
    <div className='caption-textarea'>
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        data-key={dataKey}
      />
      {suggestions.length > 0 && (
        <ul className='caption-textarea__suggestions' role='listbox'>
          {suggestions.map((s, i) => (
            <li
              key={`a:${s.account.id}`}
              className={`caption-textarea__suggestion${
                i === selectedIndex
                  ? ' caption-textarea__suggestion--active'
                  : ''
              }`}
              role='option'
              aria-selected={i === selectedIndex}
              // eslint-disable-next-line react/jsx-no-bind
              onMouseDown={(e) => {
                e.preventDefault(); // keep textarea focus
                applySuggestion(s);
              }}
            >
              <Avatar
                account={createAccountFromServerJSON(s.account)}
                size={20}
              />
              <span className='caption-textarea__suggestion-label'>
                @{s.account.acct}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
