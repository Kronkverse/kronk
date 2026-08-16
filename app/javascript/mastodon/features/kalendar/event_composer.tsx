import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import axios from 'axios';

import api from 'mastodon/api';
import { apiCreateAttachment } from 'mastodon/api/attachments';
import { ComposeAttachBar } from 'mastodon/components/compose_attach_bar';
import type { PendingConnection } from 'mastodon/components/compose_attach_bar';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { MapPinPicker } from 'mastodon/components/map_pin_picker';
import type { PinnedLocation } from 'mastodon/components/map_pin_picker';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';

// Kalendar — event composer. First implementation, mounted directly
// against the shared `<ComposeShell>` standard rather than a bespoke
// page (per docs/rebuild/decisions.md 2026-08-12: "Kalendar /
// Martketplace / Huddle — declare `compose.route` in the manifest but
// no shell-shaped composer yet. Do first-implementation against this
// decision rather than shipping a bespoke one").
//
// Fields mirror the `event_params` permit list in
// `Api::V1::EventsController#event_params` — title, description, start /
// end time, location name + url, event_type (event | huddle), rsvp_enabled.
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
  type: { id: 'kalendar.new.type', defaultMessage: 'Kind' },
  typeEvent: { id: 'kalendar.new.type_event', defaultMessage: 'In-person' },
  typeHuddle: {
    id: 'kalendar.new.type_huddle',
    defaultMessage: 'Huddle (online)',
  },
  rsvpEnabled: {
    id: 'kalendar.new.rsvp_enabled',
    defaultMessage: 'Let people RSVP',
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
  inviteOnly: {
    id: 'kalendar.new.invite_only',
    defaultMessage: 'Invite-only event',
  },
  inviteOnlyHint: {
    id: 'kalendar.new.invite_only_hint',
    defaultMessage:
      "Only people you invite will see it. Won't show up in feeds.",
  },
  attachHeading: {
    id: 'kalendar.new.attach_heading',
    defaultMessage: 'Konnect a korner',
  },
  invitePeople: {
    id: 'kalendar.new.invite_people',
    defaultMessage: 'Invite people',
  },
  inviteHint: {
    id: 'kalendar.new.invite_hint',
    defaultMessage:
      'They get a nudge with the event. Optional for public / mates events; required for invite-only.',
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

type EventType = 'event' | 'huddle';

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

// Companion-record creators for the Konnect-a-korner "create new"
// sections. Each takes the freshly-created event + the pending
// connection's mini-form fields and returns the new target
// record's id (so the caller can bind it via /api/v1/attachments).
// Reach follows the event's visibility strictly (Tal 2026-08-16 —
// no override at the attachment level).
async function createCompanionAlbum(
  event: CreatedEvent,
  conn: PendingConnection,
): Promise<string | null> {
  // Fall through empty-string title → event title → literal
  // fallback. `??` doesn't do the empty-string coalesce, so an
  // explicit `.length` check is the safer path.
  const composerTitle = conn.createTitle?.trim() ?? '';
  const eventTitle = event.title ?? '';
  const title =
    composerTitle.length > 0
      ? composerTitle
      : eventTitle.length > 0
        ? eventTitle
        : 'Album';
  const body: Record<string, unknown> = {
    album: {
      title,
      visibility: event.visibility ?? 'public',
      ...(conn.createCoverId
        ? { cover_media_attachment_id: conn.createCoverId }
        : {}),
    },
  };
  const res = await api().post<{ id: string }>('/api/v1/albutts/albums', body);
  return res.data.id;
}

async function createCompanionHuddle(
  event: CreatedEvent,
  conn: PendingConnection,
): Promise<string | null> {
  const composerTitle = conn.createTitle?.trim() ?? '';
  const eventTitle = event.title ?? '';
  const name =
    composerTitle.length > 0
      ? composerTitle
      : eventTitle.length > 0
        ? eventTitle
        : 'Huddle';
  const res = await api().post<{ id: string }>('/api/v1/huddle/rooms', {
    name,
  });
  return res.data.id;
}

interface CreatePayload {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location_name?: string;
  location_url?: string;
  event_type: EventType;
  rsvp_enabled: boolean;
  visibility: ReachValue;
  image_id?: string;
  invite_only?: boolean;
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

interface Props {
  onCancel: () => void;
  onCreated: (event: CreatedEvent) => void;
}

export const EventComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();

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
  const [eventType, setEventType] = useState<EventType>('event');
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
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
  // Self-only is hidden from the ReachDropdown — the "Invite-only"
  // toggle below covers the "small audience" case with a clearer
  // mental model (docs/kronk_feed_and_reach.md §2 puts invite-only
  // on a different axis from the Mates → Orbit → Kronkverse
  // distance ladder).
  const [reach, setReach] = useState<ReachValue>('public');
  // Krew is an orthogonal additive audience axis (see the reach doc
  // §2.2): members of a targeted krew see the event on top of
  // whatever the reach picks up. `useAvailableKrews` returns the
  // viewer's selectable krews; the picker lives inside the
  // ReachDropdown's expandable Krews row.
  const availableKrews = useAvailableKrews();
  const [krewIds, setKrewIds] = useState<string[]>([]);
  // Invite-only mode — the event isn't feed-visible to anyone; only
  // the author + accounts explicitly invited can see it. When on,
  // the reach + krews above become moot (server forces
  // `visibility=self_only` regardless — see EventsController#
  // create_status_for_event!). Backing schema: PR #1480's
  // `events.invite_only` column.
  const [inviteOnly, setInviteOnly] = useState(false);
  // connections — the compose-time "Konnect a korner" intents
  // captured by `<ComposeAttachBar>` (docs/kronk_korner_attachments.md).
  // Two shapes per entry:
  //   * mode: 'create' — inline mini-form for a new record in the
  //     target korner (Albutts: title + cover; Huddle: title). On
  //     submit we POST the target's create endpoint (inheriting the
  //     event's visibility) then POST /api/v1/attachments.
  //   * mode: 'link' — the user picked an existing record via the
  //     inline search. On submit we POST /api/v1/attachments
  //     directly.
  const [connections, setConnections] = useState<PendingConnection[]>([]);
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
  const canSubmit = hasTitle && hasStart && !busy && !imageUploading;
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
  const onEventType = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setEventType(e.currentTarget.value as EventType);
    },
    [],
  );
  const onRsvpToggle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setRsvpEnabled(e.currentTarget.checked);
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

  const onInviteOnlyToggle = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setInviteOnly(e.currentTarget.checked);
  }, []);

  const onConnectionAdd = useCallback((connection: PendingConnection) => {
    setConnections((prev) => [...prev, connection]);
  }, []);

  const onConnectionUpdate = useCallback(
    (id: string, patch: Partial<PendingConnection>) => {
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const onConnectionRemove = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
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
      event_type: eventType,
      rsvp_enabled: rsvpEnabled,
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
    if (inviteOnly) payload.invite_only = true;
    // Krews are silently dropped server-side when invite_only is on
    // (no fan-out for `self_only` visibility) but there's no reason
    // to send them either — matches the UI where the picker greys
    // out under the invite-only toggle.
    if (!inviteOnly && krewIds.length > 0) payload.krew_ids = krewIds;

    const inviteeIds = Array.from(invitees.keys());
    // Snapshot for the post-create side-effect walk. Filter out
    // link-mode connections that never picked a target (empty search)
    // and create-mode connections that are still empty forms.
    const pendingConnections = connections.filter((c) => {
      if (c.mode === 'link') return Boolean(c.linkTargetId);
      return true;
    });

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

        // Walk pending connections. For each:
        //   * link: POST /api/v1/attachments with source event id +
        //     picked target id.
        //   * create: POST the target korner's own create endpoint
        //     (Albutts /api/v1/albutts/albums or Huddle
        //     /api/v1/huddle/rooms) with fields from the mini-form,
        //     inheriting the event's visibility. Then POST the
        //     KornerAttachment binding it to the source event.
        // Same soft-failure story as invitees — the event is real;
        // partial success is surfaced through the error strip but
        // still returns the user to the detail page (they can retry
        // from the AttachmentSection's picker there).
        for (const conn of pendingConnections) {
          try {
            let targetId: string | null = null;
            if (conn.mode === 'link') {
              targetId = conn.linkTargetId ?? null;
            } else if (conn.targetSlug === 'albutts') {
              targetId = await createCompanionAlbum(res.data, conn);
            } else if (conn.targetSlug === 'huddle') {
              targetId = await createCompanionHuddle(res.data, conn);
            }
            if (!targetId) continue;

            await apiCreateAttachment({
              source_slug: 'kalendar',
              source_id: res.data.id,
              target_slug: conn.targetSlug,
              target_id: targetId,
              kind: 'link',
            });
          } catch (attachErr: unknown) {
            setError(extractApiError(attachErr));
          }
        }
        onCreated(res.data);
        // Parent unmounts on success — no need to reset state.
      } catch (e: unknown) {
        setError(extractApiError(e));
        setBusy(false);
      }
    })();
  }, [
    connections,
    description,
    endIso,
    eventType,
    imageMediaId,
    invitees,
    inviteOnly,
    krewIds,
    locationName,
    locationUrl,
    onCreated,
    reach,
    rsvpEnabled,
    startIso,
    title,
  ]);

  const reachControl = (
    <ReachDropdown
      value={reach}
      onChange={onReach}
      // Disabled while a submit is in flight, AND while invite-only
      // is on (the reach / krews are moot then — the event is
      // gated by the invitation list, not fed to any timeline).
      disabled={busy || inviteOnly}
      hide={['self_only']}
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
    >
      <div className='event-composer'>
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
            <p className='event-composer__error' role='alert'>
              <FormattedMessage
                {...messages.coverUploadFailed}
                values={{ error: imageError }}
              />
            </p>
          )}
        </div>

        <label className='event-composer__field'>
          <span className='event-composer__field-label'>
            {intl.formatMessage(messages.eventTitle)}
          </span>
          <input
            type='text'
            value={title}
            onChange={onTitle}
            placeholder={intl.formatMessage(messages.eventTitlePlaceholder)}
            required
            className='event-composer__input'
          />
        </label>

        <label className='event-composer__field'>
          <span className='event-composer__field-label'>
            {intl.formatMessage(messages.description)}
          </span>
          <textarea
            value={description}
            onChange={onDescription}
            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
            rows={3}
            className='event-composer__input'
          />
        </label>

        <fieldset className='event-composer__fieldset'>
          <legend className='event-composer__legend'>
            {intl.formatMessage(messages.when)}
          </legend>
          <div className='event-composer__row'>
            <span className='event-composer__field event-composer__field--half'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.starts)}
              </span>
              <div className='event-composer__datetime'>
                <input
                  type='date'
                  aria-label={intl.formatMessage(messages.startDate)}
                  value={startDate}
                  onChange={onStartDate}
                  onClick={openPickerOnClick}
                  required
                  className='event-composer__input'
                />
                <input
                  type='time'
                  aria-label={intl.formatMessage(messages.startTime)}
                  value={startTime}
                  onChange={onStartTime}
                  onClick={openPickerOnClick}
                  required
                  step={SNAP_MINUTES * 60}
                  className='event-composer__input'
                />
              </div>
            </span>
            <span className='event-composer__field event-composer__field--half'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.ends)}
              </span>
              <div className='event-composer__datetime'>
                <input
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
                  className='event-composer__input'
                />
                <input
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
                  className='event-composer__input'
                />
              </div>
            </span>
          </div>
        </fieldset>

        <fieldset className='event-composer__fieldset'>
          <legend className='event-composer__legend'>
            {intl.formatMessage(messages.type)}
          </legend>
          <div className='event-composer__radio-row'>
            <label className='event-composer__radio'>
              <input
                type='radio'
                name='event-type'
                value='event'
                checked={eventType === 'event'}
                onChange={onEventType}
              />
              <span>{intl.formatMessage(messages.typeEvent)}</span>
            </label>
            <label className='event-composer__radio'>
              <input
                type='radio'
                name='event-type'
                value='huddle'
                checked={eventType === 'huddle'}
                onChange={onEventType}
              />
              <span>{intl.formatMessage(messages.typeHuddle)}</span>
            </label>
          </div>
        </fieldset>

        {eventType === 'event' && (
          <fieldset className='event-composer__fieldset'>
            <legend className='event-composer__legend'>
              {intl.formatMessage(messages.where)}
            </legend>
            <label className='event-composer__field'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.address)}
              </span>
              <input
                type='text'
                value={locationName}
                onChange={onLocationName}
                placeholder={intl.formatMessage(messages.addressPlaceholder)}
                className='event-composer__input'
              />
            </label>
            <label className='event-composer__field'>
              <span className='event-composer__field-label'>
                {intl.formatMessage(messages.mapLink)}
              </span>
              <input
                type='url'
                value={locationUrl}
                onChange={onLocationUrl}
                placeholder={intl.formatMessage(messages.mapLinkPlaceholder)}
                className='event-composer__input'
              />
              <small className='event-composer__field-hint'>
                {intl.formatMessage(messages.mapLinkHint)}
              </small>
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
                  className='event-composer__pin-preview'
                />
              )}
            </label>
          </fieldset>
        )}

        <label className='event-composer__checkbox'>
          <input
            type='checkbox'
            checked={rsvpEnabled}
            onChange={onRsvpToggle}
          />
          <span>{intl.formatMessage(messages.rsvpEnabled)}</span>
        </label>

        {/* Invite-only toggle — flips the event to `invite_only=true`.
            When on, the reach dropdown + krew picker are disabled
            (fan-out is off; only invitees see the event). The hint
            spells out the trade-off so the user knows what they're
            signing up for. */}
        <label className='event-composer__toggle-block'>
          <span className='event-composer__toggle-row'>
            <input
              type='checkbox'
              checked={inviteOnly}
              onChange={onInviteOnlyToggle}
            />
            <span className='event-composer__toggle-label'>
              {intl.formatMessage(messages.inviteOnly)}
            </span>
          </span>
          <small className='event-composer__field-hint'>
            {intl.formatMessage(messages.inviteOnlyHint)}
          </small>
        </label>

        {/* "Konnect a korner" — the compose-time inter-korner
            attach surface (docs/kronk_korner_attachments.md). The
            bar reads Kalendar's `attaches:` manifest to know which
            spaces are reachable, then stacks an inline mini-form
            per picked connection. Create-mode (Albutts, Huddle)
            POSTs the target's own create endpoint on submit;
            link-mode POSTs KornerAttachment directly. Reach is
            strict-inherited from the event. */}
        <fieldset className='event-composer__fieldset'>
          <legend className='event-composer__legend'>
            {intl.formatMessage(messages.attachHeading)}
          </legend>
          <ComposeAttachBar
            sourceSlug='kalendar'
            connections={connections}
            onAdd={onConnectionAdd}
            onUpdate={onConnectionUpdate}
            onRemove={onConnectionRemove}
            disabled={busy}
          />
        </fieldset>

        {/* Invitee picker — accounts get a nudge with the event on
            submit. Optional for public/mates events; the natural
            partner to the invite-only toggle above. Same account
            search API the event-detail Invite panel uses; the two
            surfaces stay in shape. */}
        <div className='event-composer__invitees'>
          <span className='event-composer__field-label'>
            {intl.formatMessage(messages.invitePeople)}
          </span>
          <small className='event-composer__field-hint'>
            {intl.formatMessage(messages.inviteHint)}
          </small>
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
            <input
              type='search'
              value={inviteeQuery}
              onChange={onInviteeQueryChange}
              placeholder={intl.formatMessage(
                messages.inviteeSearchPlaceholder,
              )}
              className='event-composer__input'
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
          <p className='event-composer__error' role='alert'>
            <FormattedMessage
              id='kalendar.new.error'
              defaultMessage="Couldn't create the event: {error}"
              values={{ error }}
            />
          </p>
        )}

        {submitBlockerMessage && (
          <p className='event-composer__submit-hint'>
            <FormattedMessage {...submitBlockerMessage} />
          </p>
        )}
      </div>

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
