import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import axios from 'axios';

import api from 'mastodon/api';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeSection,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type { PinnedLocation } from 'mastodon/components/map_pin_picker';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

// Kalendar — event composer. First implementation, mounted directly
// against the shared `<ComposeShell>` standard rather than a bespoke
// page (per docs/decisions.md 2026-08-12: "Kalendar /
// Wachuneed / Huddle — declare `compose.route` in the manifest but
// no shell-shaped composer yet. Do first-implementation against this
// decision rather than shipping a bespoke one").
//
// Fields mirror the `event_params` permit list in
// `Api::V1::EventsController#event_params` — title, description, start /
// end time, location name + url. `event_type` (event | huddle) +
// `rsvp_enabled` are no longer sent from this composer (Tal
// 2026-08-17): every event created here is `event`, and RSVP is on
// by DB default; server permits them but the composer omits them.
// `visibility` sits alongside (not in event_params) — the controller
// reads it to seed the accompanying Status via PostStatusService. Reach
// lives in the shell's `headerAction` slot, the same treatment Moments
// + trek composer use.

const messages = defineMessages({
  label: { id: 'kalendar.new.title', defaultMessage: 'New event' },
  subtitle: {
    id: 'kalendar.new.subtitle',
    defaultMessage: 'A shared time for the people you invite.',
  },
  eventTitle: { id: 'kalendar.new.event_title', defaultMessage: 'Title' },
  eventTitlePlaceholder: {
    id: 'kalendar.new.event_title_placeholder',
    defaultMessage: 'What is happening?',
  },
  description: {
    id: 'kalendar.new.description',
    defaultMessage: 'Description',
  },
  descriptionPlaceholder: {
    id: 'kalendar.new.description_placeholder',
    defaultMessage: 'What people should know before they show up.',
  },
  when: { id: 'kalendar.new.when', defaultMessage: 'When' },
  starts: { id: 'kalendar.new.starts', defaultMessage: 'Starts' },
  ends: { id: 'kalendar.new.ends', defaultMessage: 'Ends (optional)' },
  where: { id: 'kalendar.new.where', defaultMessage: 'Where' },
  address: {
    id: 'kalendar.new.address',
    defaultMessage: 'Address',
  },
  addressPlaceholder: {
    id: 'kalendar.new.address_placeholder',
    defaultMessage:
      "A pub, a park, an address — write however you'd text a friend.",
  },
  mapLink: {
    id: 'kalendar.new.map_link',
    defaultMessage: 'Map link (optional)',
  },
  mapLinkHint: {
    id: 'kalendar.new.map_link_hint',
    defaultMessage:
      'A map link people can open in any browser — type one, or use Pin on map below.',
  },
  mapLinkPlaceholder: {
    id: 'kalendar.new.map_link_placeholder',
    defaultMessage: 'https://…',
  },
  startDate: { id: 'kalendar.new.start_date', defaultMessage: 'Date' },
  startTime: { id: 'kalendar.new.start_time', defaultMessage: 'Time' },
  endDate: { id: 'kalendar.new.end_date', defaultMessage: 'End date' },
  endTime: { id: 'kalendar.new.end_time', defaultMessage: 'End time' },
  pinOnMap: {
    id: 'kalendar.new.pin_on_map',
    defaultMessage: 'Pin on map',
  },
  pinnedAt: {
    id: 'kalendar.new.pinned_at',
    defaultMessage: 'Pinned at {lat}, {lng}',
  },
  clearPin: {
    id: 'kalendar.new.clear_pin',
    defaultMessage: 'Clear pin',
  },
  create: { id: 'kalendar.new.create', defaultMessage: 'Post it' },
  creating: { id: 'kalendar.new.creating', defaultMessage: 'Posting…' },
  needTitleAndStart: {
    id: 'kalendar.new.need_title_and_start',
    defaultMessage: 'Add a title and pick a start date + time to post.',
  },
  needTitle: {
    id: 'kalendar.new.need_title',
    defaultMessage: 'Add a title to post.',
  },
  needStart: {
    id: 'kalendar.new.need_start',
    defaultMessage: 'Pick a start date + time to post.',
  },
  cover: {
    id: 'kalendar.new.cover',
    defaultMessage: 'Cover image (optional)',
  },
  addCover: {
    id: 'kalendar.new.add_cover',
    defaultMessage: 'Choose an image',
  },
  uploadingCover: {
    id: 'kalendar.new.uploading_cover',
    defaultMessage: 'Uploading…',
  },
  removeCover: {
    id: 'kalendar.new.remove_cover',
    defaultMessage: 'Remove image',
  },
  coverUploadFailed: {
    id: 'kalendar.new.cover_upload_failed',
    defaultMessage: "Couldn't upload the image: {error}",
  },
  invitePeople: {
    id: 'kalendar.new.invite_people',
    defaultMessage: 'Invite people',
  },
  inviteHint: {
    id: 'kalendar.new.invite_hint',
    defaultMessage:
      'They get a nudge with the event. Optional — the scope decides who else sees it.',
  },
  needEndAfterStart: {
    id: 'kalendar.new.need_end_after_start',
    defaultMessage: 'End time has to be after the start time.',
  },
  inviteeSearchPlaceholder: {
    id: 'kalendar.new.invitee_search_placeholder',
    defaultMessage: 'Search @handle or name',
  },
  inviteeSearching: {
    id: 'kalendar.new.invitee_searching',
    defaultMessage: 'Searching…',
  },
  inviteeNoResults: {
    id: 'kalendar.new.invitee_no_results',
    defaultMessage: 'No matches.',
  },
  inviteeRemove: {
    id: 'kalendar.new.invitee_remove',
    defaultMessage: 'Remove {name}',
  },
});

// The server returns the full event record; we only need the URL
// identifier here so the caller can navigate to
// `/hub/kalendar/<slug>`. Slug is preferred (human-readable, added
// 2026-08-14); id is kept for older events lacking a slug + as a
// safety fallback if the server ever ships without one.
export interface CreatedEvent {
  id: string;
  slug?: string;
  visibility?: string | null;
  title?: string;
  image_url?: string | null;
}

interface CreatePayload {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location_name?: string;
  location_url?: string;
  visibility: ReachValue;
  image_id?: string;
  krew_ids?: string[];
}

// Shape returned by POST /api/v2/media. Only the ID is required to
// attach the media to a Status/Event; the preview_url is used inline
// for the in-composer thumbnail so the user sees exactly what they
// just uploaded.
interface MediaResponse {
  id: string;
  preview_url?: string | null;
  url?: string | null;
}

// Search hit + selected-invitee shape from the account search API.
// Kept in the composer scope (rather than pulled from a shared
// AccountSerializer type) because we only need the four fields for
// the picker chip + dropdown row.
interface InviteeAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
}

// Combine a date input ("YYYY-MM-DD") + time input ("HH:MM") into an
// ISO string in the browser's local zone. Returns null when either
// half is missing so callers can skip the field.
const combineLocal = (date: string, time: string): string | null => {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

// Format a JS Date as the browser's local `<input type="date">` value.
const dateInputValue = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const timeInputValue = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// Round `d` up to the next SNAP-minute boundary — so 14:23 → 14:25 with
// a 5-min snap. Matches the `<input type="time" step>` snap Tal asked
// for (2026-08-14) so the auto-filled default sits on the same grid
// the picker offers.
const SNAP_MINUTES = 5;
const roundUpToSnap = (d: Date): Date => {
  const out = new Date(d);
  const mins = out.getMinutes();
  const remainder = mins % SNAP_MINUTES;
  if (remainder !== 0 || out.getSeconds() > 0 || out.getMilliseconds() > 0) {
    out.setMinutes(mins + (SNAP_MINUTES - remainder));
  }
  out.setSeconds(0, 0);
  return out;
};

// Default start = now, rounded up to the next 5-min slot.
// Default end   = start + 2 hours.
// Both split into their date + time inputs so the user can tweak either
// half without recomputing the other. Computed once at mount via lazy
// useState so refreshing the composer doesn't drift the defaults every
// render.
interface DefaultTimes {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}
const computeDefaultTimes = (): DefaultTimes => {
  const start = roundUpToSnap(new Date());
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    startDate: dateInputValue(start),
    startTime: timeInputValue(start),
    endDate: dateInputValue(end),
    endTime: timeInputValue(end),
  };
};

// Pull a useful message out of an axios error. Rails returns 4xx
// bodies in one of a few shapes — `{ error: "…" }` (single message),
// `{ errors: { field: [msg, …], … } }` (ActiveRecord validation),
// or `{ error: { … } }` (nested). Falls back to axios's default
// message so we always show *something* helpful instead of the
// generic "Request failed with status code 422" that hides the
// actual field problem (Tal 2026-08-14: hit Post it, saw only
// that generic string).
const extractApiError = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as
      | { error?: string | Record<string, unknown>; errors?: unknown }
      | undefined;
    if (data && typeof data.error === 'string') return data.error;
    if (data?.errors && typeof data.errors === 'object') {
      const entries = Object.entries(data.errors as Record<string, unknown>);
      const parts = entries.map(([field, msgs]) => {
        const list = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
        return `${field}: ${list}`;
      });
      if (parts.length > 0) return parts.join('; ');
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
};

// What an event draft keeps (docs/design.md, Drafts). The cover image goes
// as an upload id alongside.
interface EventDraftParams {
  title?: string;
  description?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  locationName?: string;
  locationUrl?: string;
  pinnedLocation?: PinnedLocation | null;
  reach?: ReachValue;
  krewIds?: string[];
  invitees?: InviteeAccount[];
  konnections?: KonnectTarget[];
}

interface Props {
  onCancel: () => void;
  onCreated: (event: CreatedEvent) => void;
  // Arriving from a Krew (`?konnect=krew:<id>` or `?krew=<id>`): the event
  // starts out for that Krew alone.
  forKrewId?: string | null;
}

export const EventComposer: React.FC<Props> = ({
  onCancel,
  onCreated,
  forKrewId,
}) => {
  const intl = useIntl();
  // What the new event will be Konnected to (decisions.md, 2026-10-23):
  // the record it was opened for (`?konnect=<slug>:<id>`) and any the
  // person adds in the Konnect row. A Krew it was opened for is the Krew
  // audience (`forKrewId`), which keeps its own link (EventLinks.posted).
  const konnect = useKonnect('kalendar', {
    sourceHandled: !!forKrewId,
  });
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Auto-fill start = now (rounded to next 5-min slot), end = +2h —
  // Tal 2026-08-14. Lazy initialiser so `new Date()` runs once at
  // mount; the user can still tweak either half.
  const defaults = useMemo(() => computeDefaultTimes(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  // Pinned coordinates from the MapPinPicker. When set, `location_url`
  // is derived from these (an OpenStreetMap link that any browser can
  // open); when cleared, the URL field goes back to whatever the user
  // typed. Storing coordinates separately from the derived URL lets
  // the "Clear pin" affordance restore the URL to empty without
  // touching the user's manual typing.
  const [pinnedLocation, setPinnedLocation] = useState<PinnedLocation | null>(
    null,
  );
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  // Event kind + RSVP-enabled toggles retired 2026-08-17. Every
  // event posted from this composer is an in-person event; huddles
  // are now spawned via the Konnect-a-korner picker (Huddle korner
  // attachment). RSVP is on by default (DB `rsvp_enabled default:
  // true`) — no toggle, no `rsvp_enabled` in the payload.
  // Cover image — uploaded to /api/v2/media as soon as the user
  // picks a file (Tal 2026-08-14: "adding an image is possible upon
  // edit, but not in the initial creation"). The returned media id
  // + preview URL live here; on submit we pass the id in the create
  // payload (the controller handles `image_id`). Object-URL preview
  // shown immediately so the thumbnail appears before the upload
  // completes.
  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  // Default to public: events are "shared time" (Kalendar manifest
  // purpose) and the manifest ships `default_event_visibility: public`.
  // Self-only is hidden from the ReachDropdown — the ReachDropdown's
  // "self" option covers the small-audience case now (the dedicated
  // Invite-only toggle was retired 2026-08-17: it's an audience
  // choice, so the scope picker owns it).
  const [reach, setReach] = useState<ReachValue>(
    forKrewId ? 'self_only' : 'public',
  );
  // Krew is an orthogonal additive audience axis (see the reach doc
  // §2.2): members of a targeted krew see the event on top of
  // whatever the reach picks up. `useAvailableKrews` returns the
  // viewer's selectable krews; the picker lives inside the
  // ReachDropdown's expandable Krews row.
  const availableKrews = useAvailableKrews();
  const [krewIds, setKrewIds] = useState<string[]>(
    forKrewId ? [forKrewId] : [],
  );
  // Invitees (Tal 2026-08-14: "invite into composer"). Accounts the
  // user has picked from the search results. Stored as a Map keyed
  // by id so we can render chips with names/avatars (search results
  // turn over each keystroke — we can't rely on them for chip
  // metadata). On submit, event is created first, then
  // `POST /events/:id/invite` fires with the accumulated ids. See
  // handleInviteeSelect / handleInviteeRemove.
  const [invitees, setInvitees] = useState<Map<string, InviteeAccount>>(
    () => new Map(),
  );
  const [inviteeQuery, setInviteeQuery] = useState('');
  const [inviteeResults, setInviteeResults] = useState<InviteeAccount[]>([]);
  const [inviteeSearching, setInviteeSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drafts: what you've written is saved as you go, here and on the
  // server, and comes back when the composer opens again.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<EventDraftParams> | null) => {
      const p = d?.params ?? {};
      const times = computeDefaultTimes();
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setStartDate(p.startDate ?? times.startDate);
      setStartTime(p.startTime ?? times.startTime);
      setEndDate(p.endDate ?? times.endDate);
      setEndTime(p.endTime ?? times.endTime);
      setLocationName(p.locationName ?? '');
      setLocationUrl(p.locationUrl ?? '');
      setPinnedLocation(p.pinnedLocation ?? null);
      setReach(p.reach ?? (forKrewId ? 'self_only' : 'public'));
      setKrewIds(p.krewIds ?? (forKrewId ? [forKrewId] : []));
      setInvitees(new Map((p.invitees ?? []).map((a) => [a.id, a])));
      restoreKonnect(p.konnections);
      const cover = d?.media_attachments[0];
      setImageMediaId(cover?.id ?? null);
      setImagePreviewUrl(cover?.preview_url ?? cover?.url ?? null);
      setImageError(null);
    },
    [forKrewId, restoreKonnect],
  );

  const draft = useDraft<EventDraftParams>({
    korner: 'kalendar',
    kind: 'event',
    context: forKrewId ? `krew:${forKrewId}` : null,
    snapshot: {
      params: {
        title,
        description,
        startDate,
        startTime,
        endDate,
        endTime,
        locationName,
        locationUrl,
        pinnedLocation,
        reach,
        krewIds,
        invitees: Array.from(invitees.values()),
        konnections: konnect.saved,
      },
      mediaIds: imageMediaId ? [imageMediaId] : [],
    },
    hasContent:
      title.trim() !== '' ||
      description.trim() !== '' ||
      locationName.trim() !== '' ||
      locationUrl.trim() !== '' ||
      imageMediaId !== null ||
      invitees.size > 0,
    apply: applyDraft,
    describe: (d) => d.params.title,
    paused: busy,
  });

  const finishDraft = draft.finish;

  const startIso = useMemo(
    () => combineLocal(startDate, startTime),
    [startDate, startTime],
  );
  const endIso = useMemo(
    () => combineLocal(endDate, endTime),
    [endDate, endTime],
  );

  const hasTitle = title.trim().length > 0;
  const hasStart = startIso !== null;
  // End must land AFTER start. String compare on the ISO-8601 output
  // of `combineLocal` (same time zone; lex order = chrono order).
  // Only flags when both are set — an empty end just means "no
  // fixed end time" and stays valid.
  const endBeforeStart =
    startIso !== null && endIso !== null && endIso <= startIso;
  const canSubmit =
    hasTitle && hasStart && !endBeforeStart && !busy && !imageUploading;
  // Pick a single hint that spells out what's blocking submit. Shown
  // whenever the ComposeShell's primary CTA is disabled, so the
  // "hit Post it, nothing happens" trap (Tal 2026-08-14) is answered
  // in-place: greyed button + a line below the form saying exactly
  // why. Not shown while a submit is in flight (busy).
  const submitBlockerMessage = busy
    ? null
    : !hasTitle && !hasStart
      ? messages.needTitleAndStart
      : !hasTitle
        ? messages.needTitle
        : !hasStart
          ? messages.needStart
          : endBeforeStart
            ? messages.needEndAfterStart
            : null;

  const onTitle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setTitle(e.target.value);
    },
    [],
  );
  const onDescription = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.target.value);
  }, []);
  const onStartDate = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setStartDate(e.target.value);
    },
    [],
  );
  const onStartTime = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setStartTime(e.target.value);
    },
    [],
  );
  const onEndDate = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setEndDate(e.target.value);
    },
    [],
  );
  const onEndTime = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setEndTime(e.target.value);
    },
    [],
  );
  const onLocationName = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setLocationName(e.target.value);
  }, []);
  const onLocationUrl = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setLocationUrl(e.target.value);
    },
    [],
  );
  const onReach = useCallback((value: ReachValue) => {
    setReach(value);
  }, []);

  const onToggleKrew = useCallback((id: string) => {
    setKrewIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );
  }, []);

  // Debounced account search for the invitee picker. Same endpoint
  // the event-detail Invite panel already uses (`GET /api/v1/accounts/
  // search`), 300ms debounce + 6-result cap, cancel-on-change via a
  // scoped flag so late responses don't clobber the latest results.
  useEffect(() => {
    const trimmed = inviteeQuery.trim();
    if (trimmed.length === 0) {
      setInviteeResults([]);
      setInviteeSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setInviteeSearching(true);
      api()
        .get<InviteeAccount[]>('/api/v1/accounts/search', {
          params: { q: trimmed, limit: 6, resolve: false },
        })
        .then((res) => {
          if (cancelled) return;
          setInviteeResults(res.data);
          setInviteeSearching(false);
        })
        .catch(() => {
          if (cancelled) return;
          setInviteeResults([]);
          setInviteeSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inviteeQuery]);

  const onInviteeQueryChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setInviteeQuery(e.target.value);
  }, []);

  const handleInviteeSelect = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const id = e.currentTarget.dataset.accountId;
    if (!id) return;
    const account = JSON.parse(
      e.currentTarget.dataset.account ?? 'null',
    ) as InviteeAccount | null;
    if (!account) return;
    setInvitees((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, account);
      return next;
    });
    setInviteeQuery('');
    setInviteeResults([]);
  }, []);

  const handleInviteeRemove = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const id = e.currentTarget.dataset.accountId;
    if (!id) return;
    setInvitees((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Force the native date/time picker open on click. Chromium supports
  // `HTMLInputElement.showPicker()` since v99 — without this, some
  // browsers only open the picker when the user clicks the tiny
  // calendar/clock icon at the right edge of the input, which is a
  // frustrating hit target inside a narrow composer field (Tal
  // 2026-08-14: "the date selecter doesn't drop down"). Guarded on
  // `showPicker` existing so older browsers fall back to their
  // default click-to-focus behaviour without erroring.
  const openPickerOnClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (typeof e.currentTarget.showPicker === 'function') {
        try {
          e.currentTarget.showPicker();
        } catch {
          // showPicker throws NotAllowedError if called without a user
          // gesture — the click event IS the gesture so this shouldn't
          // fire, but swallowing keeps the composer resilient to
          // vendor-specific edge cases.
        }
      }
    },
    [],
  );

  // Cover image upload — fires the moment the user picks a file so
  // the id is ready by the time they hit Post it. Shows an immediate
  // object-URL preview so the thumbnail appears without waiting for
  // the server round-trip; the object URL is revoked once the server
  // returns a real `preview_url`.
  const onImageChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const file = e.currentTarget.files?.[0];
      // Reset the input so the same file can be re-picked after a clear
      // (browsers otherwise ignore an unchanged value).
      e.currentTarget.value = '';
      if (!file) return;
      setImageError(null);
      setImageUploading(true);
      const objectUrl = URL.createObjectURL(file);
      setImagePreviewUrl(objectUrl);
      const form = new FormData();
      form.append('file', file);
      void (async () => {
        try {
          const res = await api().post<MediaResponse>('/api/v2/media', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setImageMediaId(res.data.id);
          // Swap the object URL for the server's preview_url once it's
          // available so we don't leak the blob and the thumbnail
          // matches what viewers will see. Fall back to keeping the
          // object URL if the server didn't ship a preview yet
          // (paperclip previews are async).
          if (res.data.preview_url) {
            URL.revokeObjectURL(objectUrl);
            setImagePreviewUrl(res.data.preview_url);
          }
          setImageUploading(false);
        } catch (err: unknown) {
          URL.revokeObjectURL(objectUrl);
          setImagePreviewUrl(null);
          setImageError(extractApiError(err));
          setImageUploading(false);
        }
      })();
    },
    [],
  );

  const onImageRemove = useCallback(() => {
    if (imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageMediaId(null);
    setImagePreviewUrl(null);
    setImageError(null);
    setImageUploading(false);
  }, [imagePreviewUrl]);

  // The cover file input is display:none (per the file-input aesthetic
  // guard); a focusable <button> drives it via this ref, keeping the
  // control keyboard-reachable — matching features/moments/composer.tsx.
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const onCoverAddClick = useCallback(() => {
    coverInputRef.current?.click();
  }, []);

  const openPinPicker = useCallback(() => {
    setPinPickerOpen(true);
  }, []);
  const cancelPinPicker = useCallback(() => {
    setPinPickerOpen(false);
  }, []);
  // Format an OSM URL for the pinned point. Zoom is clamped for
  // sensible sharing (17 is street-level, higher zooms don't add
  // clarity for "meet here" purposes).
  const handlePin = useCallback((pin: PinnedLocation) => {
    setPinnedLocation(pin);
    const displayZoom = Math.min(17, Math.max(12, Math.round(pin.zoom)));
    setLocationUrl(
      `https://www.openstreetmap.org/?mlat=${pin.lat.toFixed(5)}&mlon=${pin.lng.toFixed(5)}#map=${displayZoom}/${pin.lat.toFixed(5)}/${pin.lng.toFixed(5)}`,
    );
    setPinPickerOpen(false);
  }, []);
  const clearPin = useCallback(() => {
    setPinnedLocation(null);
    setLocationUrl('');
  }, []);

  const submit = useCallback(() => {
    if (!startIso) return;
    setError(null);
    setBusy(true);
    const payload: CreatePayload = {
      title: title.trim(),
      start_time: startIso,
      visibility: reach,
    };
    const trimmedDescription = description.trim();
    if (trimmedDescription) payload.description = trimmedDescription;
    if (endIso) payload.end_time = endIso;
    const trimmedLocationName = locationName.trim();
    if (trimmedLocationName) payload.location_name = trimmedLocationName;
    const trimmedLocationUrl = locationUrl.trim();
    if (trimmedLocationUrl) payload.location_url = trimmedLocationUrl;
    if (imageMediaId) payload.image_id = imageMediaId;
    if (krewIds.length > 0) payload.krew_ids = krewIds;

    const inviteeIds = Array.from(invitees.keys());

    void (async () => {
      try {
        const res = await api().post<CreatedEvent>('/api/v1/events', payload);
        // If the user picked invitees during composition, invite them
        // now — one request with all ids so the server does the fan-
        // out of nudges as a single unit. Failure here doesn't roll
        // the event back: the event exists, the author can still
        // invite from the detail page. Surface the error so they
        // notice rather than silently swallowing it.
        if (inviteeIds.length > 0) {
          try {
            await api().post(`/api/v1/events/${res.data.id}/invite`, {
              account_ids: inviteeIds,
            });
          } catch (inviteErr: unknown) {
            setError(extractApiError(inviteErr));
          }
        }

        await commitKonnect('kalendar', res.data.id);
        finishDraft();
        onCreated(res.data);
        // Parent unmounts on success — no need to reset state.
      } catch (e: unknown) {
        setError(extractApiError(e));
        setBusy(false);
      }
    })();
  }, [
    commitKonnect,
    description,
    endIso,
    finishDraft,
    imageMediaId,
    invitees,
    krewIds,
    locationName,
    locationUrl,
    onCreated,
    reach,
    startIso,
    title,
  ]);

  const krewNames = availableKrews
    .filter((krew) => krewIds.includes(krew.id))
    .map((krew) => krew.name);

  const reachControl = (
    <ReachDropdown
      value={reach}
      onChange={onReach}
      disabled={busy}
      // "Me" with a Krew ticked is an event for that Krew alone, so the
      // rung is offered to anyone who has a Krew to tick. Without one it
      // would be an event nobody else can see.
      hide={availableKrews.length > 0 ? [] : ['self_only']}
      krews={availableKrews}
      selectedKrewIds={krewIds}
      onToggleKrew={onToggleKrew}
    />
  );

  return (
    <ComposeShell
      korner='kalendar'
      label={intl.formatMessage(messages.label)}
      subtitle={intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(messages.create)}
      submittingLabel={intl.formatMessage(messages.creating)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={submit}
      onCancel={onCancel}
      headerAction={reachControl}
      draft={draft}
      konnect={konnect}
    >
      {reach === 'self_only' && (
        <ComposeHint>
          {krewNames.length > 0 ? (
            <FormattedMessage
              id='kalendar.composer.audience.krews'
              defaultMessage='Only members of {krews} will see this event.'
              values={{
                krews: intl.formatList(krewNames, { type: 'conjunction' }),
              }}
            />
          ) : (
            <FormattedMessage
              id='kalendar.composer.audience.nobody'
              defaultMessage='Only you will see this event. Tick a Krew in the reach menu to make it theirs.'
            />
          )}
        </ComposeHint>
      )}
      <div className='event-composer__cover'>
        {imagePreviewUrl ? (
          <div className='event-composer__cover-preview'>
            <img
              src={imagePreviewUrl}
              alt=''
              className='event-composer__cover-image'
            />
            {imageUploading && (
              <span className='event-composer__cover-badge'>
                <FormattedMessage {...messages.uploadingCover} />
              </span>
            )}
            <button
              type='button'
              className='event-composer__cover-remove'
              onClick={onImageRemove}
              aria-label={intl.formatMessage(messages.removeCover)}
            >
              ×
            </button>
          </div>
        ) : (
          <>
            <button
              type='button'
              className='event-composer__cover-add'
              onClick={onCoverAddClick}
            >
              <span>
                <FormattedMessage {...messages.addCover} />
              </span>
              <small>
                <FormattedMessage {...messages.cover} />
              </small>
            </button>
            <input
              ref={coverInputRef}
              type='file'
              accept='image/*'
              onChange={onImageChange}
              className='event-composer__cover-input'
            />
          </>
        )}
        {imageError && (
          <ComposeHint error>
            <FormattedMessage
              {...messages.coverUploadFailed}
              values={{ error: imageError }}
            />
          </ComposeHint>
        )}
      </div>

      <ComposeTitle
        value={title}
        onChange={onTitle}
        placeholder={intl.formatMessage(messages.eventTitlePlaceholder)}
        aria-label={intl.formatMessage(messages.eventTitle)}
        required
      />

      <ComposeBody
        value={description}
        onChange={onDescription}
        placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
        aria-label={intl.formatMessage(messages.description)}
      />

      <ComposeSection title={intl.formatMessage(messages.when)}>
        <ComposeField label={intl.formatMessage(messages.starts)}>
          <ComposeRow>
            <ComposeInput
              type='date'
              aria-label={intl.formatMessage(messages.startDate)}
              value={startDate}
              onChange={onStartDate}
              onClick={openPickerOnClick}
              required
              className='event-composer__when-input'
            />
            <ComposeInput
              type='time'
              aria-label={intl.formatMessage(messages.startTime)}
              value={startTime}
              onChange={onStartTime}
              onClick={openPickerOnClick}
              required
              step={SNAP_MINUTES * 60}
              className='event-composer__when-input'
            />
          </ComposeRow>
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.ends)}>
          <ComposeRow>
            <ComposeInput
              type='date'
              aria-label={intl.formatMessage(messages.endDate)}
              value={endDate}
              onChange={onEndDate}
              onClick={openPickerOnClick}
              // Constrain end ≥ start (Tal 2026-08-14: "make it
              // impossible to select an end date before the start
              // date"). The `min` attribute greys out earlier
              // dates in the native picker + blocks form
              // submission via `checkValidity` — no separate
              // client-side validator needed.
              min={startDate || undefined}
              className='event-composer__when-input'
            />
            <ComposeInput
              type='time'
              aria-label={intl.formatMessage(messages.endTime)}
              value={endTime}
              onChange={onEndTime}
              onClick={openPickerOnClick}
              step={SNAP_MINUTES * 60}
              // Same-day event: end time can't be before start
              // time. Only apply the min when the dates match —
              // otherwise a next-day end at 08:00 would be
              // blocked by a start of 19:00.
              min={endDate && endDate === startDate ? startTime : undefined}
              className='event-composer__when-input'
            />
          </ComposeRow>
        </ComposeField>
      </ComposeSection>

      {/* Kind (event / huddle) and its `{eventType === 'event' &&}`
          gate on Where retired 2026-08-17. Huddles are now spawned
          via the Konnect-a-korner picker (Huddle korner
          attachment), so this composer only creates in-person
          events; the address block is always relevant. RSVP is on
          by default (DB default) and the "Invite-only" toggle
          retired alongside — audience is a scope-picker decision. */}
      <ComposeSection title={intl.formatMessage(messages.where)}>
        <ComposeField label={intl.formatMessage(messages.address)}>
          <ComposeInput
            value={locationName}
            onChange={onLocationName}
            placeholder={intl.formatMessage(messages.addressPlaceholder)}
          />
        </ComposeField>
        <ComposeField
          label={intl.formatMessage(messages.mapLink)}
          hint={intl.formatMessage(messages.mapLinkHint)}
        >
          <ComposeInput
            type='url'
            value={locationUrl}
            onChange={onLocationUrl}
            placeholder={intl.formatMessage(messages.mapLinkPlaceholder)}
          />
        </ComposeField>
        <div className='event-composer__pin-row'>
          <button
            type='button'
            className='event-composer__pin-btn'
            onClick={openPinPicker}
          >
            <FormattedMessage {...messages.pinOnMap} />
          </button>
          {pinnedLocation && (
            <>
              <span className='event-composer__pin-coords'>
                <FormattedMessage
                  {...messages.pinnedAt}
                  values={{
                    lat: pinnedLocation.lat.toFixed(4),
                    lng: pinnedLocation.lng.toFixed(4),
                  }}
                />
              </span>
              <button
                type='button'
                className='event-composer__pin-clear'
                onClick={clearPin}
              >
                <FormattedMessage {...messages.clearPin} />
              </button>
            </>
          )}
        </div>
        {pinnedLocation && (
          // Re-key on lat/lng so a new pin remounts the preview
          // — MapPinPreview intentionally doesn't `easeTo` on
          // prop change (see its comment about avoiding subtle
          // animations); remount is the explicit "show a new
          // pin" trigger.
          <MapPinPreview
            key={`${pinnedLocation.lat},${pinnedLocation.lng}`}
            lng={pinnedLocation.lng}
            lat={pinnedLocation.lat}
            zoom={pinnedLocation.zoom}
          />
        )}
      </ComposeSection>

      {/* Invitee picker — accounts get a nudge with the event on
          submit. Same account search API the event-detail Invite
          panel uses; the two surfaces stay in shape. A div with the
          kit's field classes rather than <ComposeField>: a label
          around the chips' and results' buttons would press them
          when its text is clicked. */}
      <div className='compose-field'>
        <span className='compose-field__label'>
          {intl.formatMessage(messages.invitePeople)}
        </span>
        <span className='compose-field__hint'>
          {intl.formatMessage(messages.inviteHint)}
        </span>
        {invitees.size > 0 && (
          <div className='event-composer__invitee-chips'>
            {Array.from(invitees.values()).map((account) => (
              <span key={account.id} className='event-composer__invitee-chip'>
                {account.avatar && (
                  <img
                    src={account.avatar}
                    alt=''
                    className='event-composer__invitee-avatar'
                  />
                )}
                <span className='event-composer__invitee-name'>
                  {account.display_name || account.username}
                </span>
                <button
                  type='button'
                  className='event-composer__invitee-remove'
                  data-account-id={account.id}
                  onClick={handleInviteeRemove}
                  aria-label={intl.formatMessage(messages.inviteeRemove, {
                    name: account.display_name || account.username,
                  })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className='event-composer__invitee-search'>
          <ComposeInput
            type='search'
            value={inviteeQuery}
            onChange={onInviteeQueryChange}
            placeholder={intl.formatMessage(messages.inviteeSearchPlaceholder)}
            aria-label={intl.formatMessage(messages.invitePeople)}
            autoComplete='off'
          />
          {inviteeQuery.trim().length > 0 && (
            <div className='event-composer__invitee-results' role='listbox'>
              {inviteeSearching && (
                <div className='event-composer__invitee-state'>
                  <FormattedMessage {...messages.inviteeSearching} />
                </div>
              )}
              {!inviteeSearching && inviteeResults.length === 0 && (
                <div className='event-composer__invitee-state'>
                  <FormattedMessage {...messages.inviteeNoResults} />
                </div>
              )}
              {!inviteeSearching &&
                inviteeResults.map((account) => {
                  const already = invitees.has(account.id);
                  return (
                    <button
                      key={account.id}
                      type='button'
                      role='option'
                      aria-selected={already}
                      className='event-composer__invitee-result'
                      data-account-id={account.id}
                      data-account={JSON.stringify(account)}
                      onClick={handleInviteeSelect}
                      disabled={already}
                    >
                      {account.avatar && (
                        <img
                          src={account.avatar}
                          alt=''
                          className='event-composer__invitee-avatar'
                        />
                      )}
                      <span className='event-composer__invitee-name'>
                        {account.display_name || account.username}
                      </span>
                      <span className='event-composer__invitee-acct'>
                        @{account.acct}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <ComposeHint error>
          <FormattedMessage
            id='kalendar.new.error'
            defaultMessage="Couldn't create the event: {error}"
            values={{ error }}
          />
        </ComposeHint>
      )}

      {submitBlockerMessage && (
        <ComposeHint>
          <FormattedMessage {...submitBlockerMessage} />
        </ComposeHint>
      )}

      {pinPickerOpen && (
        <MapPinPicker
          initial={pinnedLocation ?? undefined}
          onCancel={cancelPinPicker}
          onPin={handlePin}
        />
      )}
    </ComposeShell>
  );
};
