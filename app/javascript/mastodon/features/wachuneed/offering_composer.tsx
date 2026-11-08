import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiCloseWachuneedListing,
  apiCreateWachuneedListing,
  apiGetWachuneedListing,
  apiUpdateWachuneedListing,
} from 'mastodon/api/wachuneed';
import type { CreateListingParams } from 'mastodon/api/wachuneed';
import type { ApiShopSectionJSON } from 'mastodon/api/wachuneed_shops';
import type {
  ApiListingBookingJSON,
  ApiListingHoursJSON,
  ApiListingJSON,
  ListingBookingWhere,
  ListingOffering,
  ListingVisibility,
} from 'mastodon/api_types/wachuneed';
import {
  ComposeBody,
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeSelect,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useKonnect } from 'mastodon/hooks/useKonnect';

import { ListingPhotoField, useListingPhotos } from './listing_photo_field';
import { OFFERING_LABEL, offeringMessages } from './offering';
import { WEEKDAYS_NINE_TO_FIVE, WeeklyHoursField } from './weekly_hours_field';

// The composer for an offering that isn't a plain product (Tal,
// 2026-11-09; docs/spaces/wachuneed.md, What are you offering?): an
// Appointment, a Service or a Trip or delivery. Each asks only what that
// kind of offer needs, and writes it as an ordinary listing underneath:
//
// - Appointment: lengths and prices (a Length kind each, with how long it
//   books in `booking.lengths`), where (online, in person, or either, which
//   adds a Where choice), and the weekly hours people book from.
// - Service: packages with prices (a Package kind each; no price reads as
//   a quote), optionally "Something else" for quote requests, and what to
//   ask people (`booking.ask`, the details part).
// - Trip or delivery: a set price or a quote each trip, any time or your
//   hours, and pick-up and drop-off on the Map (the job parts).
// - Tickets: sold here or elsewhere (a link); its dates, each with a place
//   and seats, each made a Kalendar event; and ticket types with prices (a
//   Ticket kind each). A ticket request names its date.

type Offering = Exclude<ListingOffering, 'product'>;

const messages = defineMessages({
  add: { id: 'wachuneed.offer.add', defaultMessage: 'Add to shop' },
  post: { id: 'wachuneed.offer.post', defaultMessage: 'Post' },
  save: { id: 'wachuneed.item.save', defaultMessage: 'Save' },
  saving: { id: 'wachuneed.edit.saving', defaultMessage: 'Saving…' },
  loading: { id: 'wachuneed.edit.loading', defaultMessage: 'Loading listing…' },
  name: { id: 'wachuneed.item.name', defaultMessage: 'Name' },
  description: {
    id: 'wachuneed.new.field.description',
    defaultMessage: 'Description',
  },
  section: {
    id: 'wachuneed.new.field.section',
    defaultMessage: 'Section of your shop',
  },
  sectionNone: {
    id: 'wachuneed.new.section.none',
    defaultMessage: 'No section',
  },
  lengths: {
    id: 'wachuneed.offer.lengths',
    defaultMessage: 'Lengths and prices',
  },
  lengthName: {
    id: 'wachuneed.offer.length_name',
    defaultMessage: 'Name (optional)',
  },
  addLength: {
    id: 'wachuneed.offer.add_length',
    defaultMessage: '+ Add a length',
  },
  minutes: {
    id: 'wachuneed.offer.minutes',
    defaultMessage: '{minutes, plural, one {# minute} other {# minutes}}',
  },
  hours: {
    id: 'wachuneed.offer.hours',
    defaultMessage: '{hours, plural, one {# hour} other {# hours}}',
  },
  price: { id: 'wachuneed.offer.price', defaultMessage: 'Price' },
  quote: { id: 'wachuneed.offer.quote', defaultMessage: 'Quote' },
  remove: { id: 'wachuneed.offer.remove', defaultMessage: 'Remove' },
  where: { id: 'wachuneed.offer.where', defaultMessage: 'Where' },
  online: { id: 'wachuneed.offer.online', defaultMessage: 'Online' },
  inPerson: { id: 'wachuneed.offer.in_person', defaultMessage: 'In person' },
  either: { id: 'wachuneed.offer.either', defaultMessage: 'Either' },
  free: { id: 'wachuneed.offer.free', defaultMessage: 'When you are free' },
  freeHint: {
    id: 'wachuneed.offer.free_hint',
    defaultMessage:
      'People pick a free time; you accept, and it goes in both your Kalendars.',
  },
  packages: { id: 'wachuneed.offer.packages', defaultMessage: 'Packages' },
  packageName: {
    id: 'wachuneed.offer.package_name',
    defaultMessage: 'Mix and master',
  },
  packageHint: {
    id: 'wachuneed.offer.package_hint',
    defaultMessage: 'Leave a price blank to quote it.',
  },
  addPackage: {
    id: 'wachuneed.offer.add_package',
    defaultMessage: '+ Add a package',
  },
  takeQuotes: {
    id: 'wachuneed.offer.take_quotes',
    defaultMessage: 'Also take quote requests',
  },
  takeQuotesHint: {
    id: 'wachuneed.offer.take_quotes_hint',
    defaultMessage: "For anything that doesn't fit a package",
  },
  somethingElse: {
    id: 'wachuneed.offer.something_else',
    defaultMessage: 'Something else',
  },
  ask: {
    id: 'wachuneed.offer.ask',
    defaultMessage: 'What should people tell you?',
  },
  askService: {
    id: 'wachuneed.offer.ask_service',
    defaultMessage: 'Your project, genre, deadline',
  },
  askTrip: { id: 'wachuneed.offer.ask_trip', defaultMessage: 'What is it?' },
  priceMode: { id: 'wachuneed.offer.price_mode', defaultMessage: 'Price' },
  setPrice: { id: 'wachuneed.offer.set_price', defaultMessage: 'Set price' },
  quoteEach: {
    id: 'wachuneed.offer.quote_each',
    defaultMessage: 'Quote each trip',
  },
  quoteEachHint: {
    id: 'wachuneed.offer.quote_each_hint',
    defaultMessage: 'You see where from and to before you reply with a price.',
  },
  when: { id: 'wachuneed.offer.when', defaultMessage: 'When' },
  anyTime: { id: 'wachuneed.offer.any_time', defaultMessage: 'Any time' },
  yourHours: { id: 'wachuneed.offer.your_hours', defaultMessage: 'Your hours' },
  anyTimeHint: {
    id: 'wachuneed.offer.any_time_hint',
    defaultMessage: 'People suggest a time and you say yes or no.',
  },
  tripTells: {
    id: 'wachuneed.offer.trip_tells',
    defaultMessage:
      'People drop pick-up and drop-off on the map. Only you see their places, and only on that request.',
  },
  sellHere: { id: 'wachuneed.offer.sell_here', defaultMessage: 'Sell here' },
  soldElsewhere: {
    id: 'wachuneed.offer.sold_elsewhere',
    defaultMessage: 'Sold elsewhere',
  },
  ticketUrl: {
    id: 'wachuneed.offer.ticket_url',
    defaultMessage: 'Where to get tickets',
  },
  dates: { id: 'wachuneed.offer.dates', defaultMessage: 'Dates' },
  addDate: { id: 'wachuneed.offer.add_date', defaultMessage: '+ Add a date' },
  starts: { id: 'wachuneed.offer.starts', defaultMessage: 'Starts' },
  ends: { id: 'wachuneed.offer.ends', defaultMessage: 'Ends (optional)' },
  place: { id: 'wachuneed.offer.place', defaultMessage: 'Where' },
  seats: { id: 'wachuneed.offer.seats', defaultMessage: 'Seats' },
  ticketTypes: {
    id: 'wachuneed.offer.ticket_types',
    defaultMessage: 'Tickets',
  },
  ticketName: { id: 'wachuneed.offer.ticket_name', defaultMessage: 'Full' },
  addTicketType: {
    id: 'wachuneed.offer.add_ticket_type',
    defaultMessage: '+ Add a ticket type',
  },
  ticketsHint: {
    id: 'wachuneed.offer.tickets_hint',
    defaultMessage:
      'Each date becomes a Kalendar event linked to this. People ask for a ticket; when you accept, the seats are taken and it goes in their Kalendar.',
  },
  elsewhereHint: {
    id: 'wachuneed.offer.elsewhere_hint',
    defaultMessage:
      'Your dates still show here and in Kalendar, with a button to your ticket site.',
  },
  announce: {
    id: 'wachuneed.new.announce',
    defaultMessage: 'Announce it in the feed',
  },
  error: {
    id: 'wachuneed.offer.error',
    defaultMessage: "Couldn't save it. Try again?",
  },
  takeDown: {
    id: 'wachuneed.item.take_down',
    defaultMessage: 'Take this item down',
  },
  takeDownTitle: {
    id: 'wachuneed.item.take_down_title',
    defaultMessage: 'Take {name} down?',
  },
  takeDownConfirm: {
    id: 'wachuneed.edit.take_down_confirm',
    defaultMessage: 'Take it down',
  },
  takeDownCancel: {
    id: 'wachuneed.edit.take_down_cancel',
    defaultMessage: 'Keep it up',
  },
});

const MINUTES = [15, 30, 45, 60, 90, 120, 180, 240, 480];
const MAX_ROWS = 10;
const MAX_DATES = 20;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface DateRow {
  id?: string;
  // As a datetime-local value, in this person's own time.
  start: string;
  end: string;
  place: string;
  seats: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (value: string) =>
  value ? new Date(value).toISOString() : null;

interface PriceRow {
  name: string;
  price: string;
  minutes: number;
}

const centsOf = (price: string): number | null => {
  const value = price.trim();
  if (!value) return null;
  const cents = Math.round(parseFloat(value) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
};
const priceOf = (cents: number | null | undefined) =>
  typeof cents === 'number' ? (cents / 100).toFixed(2) : '';

// A row of pills, one of which is picked.
const Pills = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) => {
  const handleClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      onChange(e.currentTarget.dataset.id as T);
    },
    [onChange],
  );
  return (
    <div className='wachuneed-pills' role='radiogroup' aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type='button'
          role='radio'
          aria-checked={value === option.id}
          data-id={option.id}
          className={
            value === option.id
              ? 'wachuneed-pills__pill wachuneed-pills__pill--on'
              : 'wachuneed-pills__pill'
          }
          onClick={handleClick}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

// One length (with how long it books) or one package, and its price.
const RowEditor: React.FC<{
  index: number;
  row: PriceRow;
  withMinutes: boolean;
  namePlaceholder: string;
  // What a blank price reads as: "Quote" for a package.
  pricePlaceholder?: string;
  onChange: (index: number, row: PriceRow | null) => void;
}> = ({
  index,
  row,
  withMinutes,
  namePlaceholder,
  pricePlaceholder,
  onChange,
}) => {
  const intl = useIntl();
  const handleName = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(index, { ...row, name: e.currentTarget.value });
    },
    [index, row, onChange],
  );
  const handleMinutes = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >(
    (e) => {
      onChange(index, { ...row, minutes: Number(e.currentTarget.value) });
    },
    [index, row, onChange],
  );
  const handlePrice = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(index, { ...row, price: e.currentTarget.value });
    },
    [index, row, onChange],
  );
  const handleRemove = useCallback(() => {
    onChange(index, null);
  }, [index, onChange]);

  return (
    <li className='wachuneed-rows__row'>
      {withMinutes && (
        <ComposeSelect
          value={row.minutes}
          onChange={handleMinutes}
          aria-label={intl.formatMessage(messages.lengths)}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {lengthLabel(intl, m)}
            </option>
          ))}
        </ComposeSelect>
      )}
      <ComposeInput
        className='wachuneed-rows__grow'
        value={row.name}
        onChange={handleName}
        placeholder={namePlaceholder}
        maxLength={60}
        aria-label={namePlaceholder}
      />
      <ComposeInput
        type='number'
        min={0}
        step={0.01}
        inputMode='decimal'
        className='wachuneed-rows__price'
        value={row.price}
        onChange={handlePrice}
        placeholder={
          pricePlaceholder ??
          (withMinutes ? '$' : intl.formatMessage(messages.quote))
        }
        aria-label={intl.formatMessage(messages.price)}
      />
      <button
        type='button'
        className='wachuneed-rows__remove'
        onClick={handleRemove}
        aria-label={intl.formatMessage(messages.remove)}
        title={intl.formatMessage(messages.remove)}
      >
        ×
      </button>
    </li>
  );
};

const lengthLabel = (intl: ReturnType<typeof useIntl>, minutes: number) =>
  minutes % 60 === 0
    ? intl.formatMessage(messages.hours, { hours: minutes / 60 })
    : intl.formatMessage(messages.minutes, { minutes });

// One date of a ticketed listing: when, where, how many seats.
const DateEditor: React.FC<{
  index: number;
  row: DateRow;
  withSeats: boolean;
  onChange: (index: number, row: DateRow | null) => void;
}> = ({ index, row, withSeats, onChange }) => {
  const intl = useIntl();
  const handle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const field = e.currentTarget.dataset.field as keyof DateRow;
      onChange(index, { ...row, [field]: e.currentTarget.value });
    },
    [index, row, onChange],
  );
  const handleRemove = useCallback(() => {
    onChange(index, null);
  }, [index, onChange]);

  return (
    <li className='wachuneed-date-row'>
      <ComposeInput
        type='datetime-local'
        data-field='start'
        value={row.start}
        onChange={handle}
        aria-label={intl.formatMessage(messages.starts)}
      />
      <ComposeInput
        type='datetime-local'
        data-field='end'
        value={row.end}
        onChange={handle}
        aria-label={intl.formatMessage(messages.ends)}
        title={intl.formatMessage(messages.ends)}
      />
      <ComposeInput
        data-field='place'
        value={row.place}
        onChange={handle}
        placeholder={intl.formatMessage(messages.place)}
        aria-label={intl.formatMessage(messages.place)}
        maxLength={200}
      />
      {withSeats && (
        <ComposeInput
          type='number'
          min={1}
          data-field='seats'
          value={row.seats}
          onChange={handle}
          placeholder={intl.formatMessage(messages.seats)}
          aria-label={intl.formatMessage(messages.seats)}
          className='wachuneed-date-row__seats'
        />
      )}
      <button
        type='button'
        className='wachuneed-rows__remove'
        onClick={handleRemove}
        aria-label={intl.formatMessage(messages.remove)}
        title={intl.formatMessage(messages.remove)}
      >
        ×
      </button>
    </li>
  );
};

interface Props {
  offering: Offering;
  // In a shop: its sections, and where a new item's reach starts.
  inShop: boolean;
  sections?: ApiShopSectionJSON[];
  shopVisibility?: ListingVisibility;
  editId?: string;
  // Back to What are you offering? (a new one only).
  onChangeOffering?: () => void;
  onCancel: () => void;
  // Saved or taken down: the listing's id (null when taken down).
  onSaved: (id: string | null) => void;
}

export const OfferingComposer: React.FC<Props> = ({
  offering,
  inShop,
  sections = [],
  shopVisibility = 'public',
  editId,
  onChangeOffering,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const photoState = useListingPhotos();
  const { load: loadPhotos } = photoState;
  const konnect = useKonnect('wachuneed');
  const commitKonnect = konnect.commit;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] =
    useState<ListingVisibility>(shopVisibility);
  const [sectionId, setSectionId] = useState('');
  const [announced, setAnnounced] = useState(!inShop);
  // Appointment
  const [lengths, setLengths] = useState<PriceRow[]>([
    { name: '', price: '', minutes: 60 },
  ]);
  const [where, setWhere] = useState<ListingBookingWhere>('either');
  const [hours, setHours] = useState<ApiListingHoursJSON[]>(
    WEEKDAYS_NINE_TO_FIVE,
  );
  // Service
  const [packages, setPackages] = useState<PriceRow[]>([
    { name: '', price: '', minutes: 0 },
  ]);
  const [takeQuotes, setTakeQuotes] = useState(true);
  const [ask, setAsk] = useState('');
  // Trip
  const [quoted, setQuoted] = useState(true);
  const [price, setPrice] = useState('');
  const [anyTime, setAnyTime] = useState(true);
  // Tickets
  const [sellHere, setSellHere] = useState(true);
  const [ticketUrl, setTicketUrl] = useState('');
  const [dates, setDates] = useState<DateRow[]>([
    { start: '', end: '', place: '', seats: '20' },
  ]);
  const [ticketTypes, setTicketTypes] = useState<PriceRow[]>([
    { name: '', price: '', minutes: 0 },
  ]);

  const [loading, setLoading] = useState(!!editId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing: read what the listing already says back into the fields.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void apiGetWachuneedListing(editId)
      .then((listing: ApiListingJSON) => {
        if (cancelled) return;
        const booking: ApiListingBookingJSON = listing.booking ?? {};
        const axis = listing.variants?.axes?.[0];
        const items = listing.variants?.items ?? [];
        const priceFor = (value: string) =>
          priceOf(
            items.find((item) => item.values[0] === value)?.price_cents ?? null,
          );
        setTitle(listing.title);
        setDescription(listing.description ?? '');
        setVisibility(listing.visibility ?? 'public');
        setSectionId(listing.shop_section_id ?? '');
        setAnnounced(listing.announced !== false);
        setAsk(booking.ask ?? '');
        if (booking.hours?.length) setHours(booking.hours);
        if (offering === 'appointment') {
          setWhere(booking.where ?? 'either');
          setLengths(
            axis
              ? axis.values.map((value) => ({
                  name: value,
                  price: priceFor(value),
                  minutes: booking.lengths?.[value] ?? 60,
                }))
              : [
                  {
                    name: '',
                    price: priceOf(listing.price_cents),
                    minutes: booking.minutes ?? 60,
                  },
                ],
          );
        }
        if (offering === 'service') {
          const somethingElse = intl.formatMessage(messages.somethingElse);
          const values = axis?.values ?? [];
          setTakeQuotes(values.includes(somethingElse) || values.length === 0);
          const kept = values.filter((value) => value !== somethingElse);
          setPackages(
            kept.length
              ? kept.map((value) => ({
                  name: value,
                  price: priceFor(value),
                  minutes: 0,
                }))
              : [{ name: '', price: '', minutes: 0 }],
          );
        }
        if (offering === 'tickets') {
          setSellHere(!listing.ticket_url);
          setTicketUrl(listing.ticket_url ?? '');
          const kept = listing.ticket_dates ?? [];
          if (kept.length)
            setDates(
              kept.map((date) => ({
                id: date.id,
                start: toLocal(date.starts_at),
                end: toLocal(date.ends_at),
                place: date.place ?? '',
                seats: date.seats ? String(date.seats) : '',
              })),
            );
          setTicketTypes(
            axis
              ? axis.values.map((value) => ({
                  name: value,
                  price: priceFor(value),
                  minutes: 0,
                }))
              : [
                  {
                    name: '',
                    price: priceOf(listing.price_cents),
                    minutes: 0,
                  },
                ],
          );
        }
        if (offering === 'trip') {
          setQuoted(typeof listing.price_cents !== 'number');
          setPrice(priceOf(listing.price_cents));
          setAnyTime(!booking.hours?.length);
        }
        loadPhotos(listing.photos ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(intl.formatMessage(messages.error));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editId, offering, intl, loadPhotos]);

  const handleTitle = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setTitle(e.currentTarget.value);
    },
    [],
  );
  const handleDescription = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.currentTarget.value);
  }, []);
  const handleSection = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setSectionId(e.currentTarget.value);
  }, []);
  const handleAsk = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setAsk(e.currentTarget.value);
    },
    [],
  );
  const handlePrice = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setPrice(e.currentTarget.value);
    },
    [],
  );
  const handleTakeQuotes = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setTakeQuotes(e.currentTarget.checked);
  }, []);
  const handleAnnounced = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setAnnounced(e.currentTarget.checked);
  }, []);

  const editRows =
    (set: React.Dispatch<React.SetStateAction<PriceRow[]>>) =>
    (index: number, row: PriceRow | null) => {
      set((rows) => {
        const next = [...rows];
        if (row) next[index] = row;
        else next.splice(index, 1);
        return next;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLength = useCallback(editRows(setLengths), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePackage = useCallback(editRows(setPackages), []);
  const addLength = useCallback(() => {
    setLengths((rows) => [...rows, { name: '', price: '', minutes: 30 }]);
  }, []);
  const addPackage = useCallback(() => {
    setPackages((rows) => [...rows, { name: '', price: '', minutes: 0 }]);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleTicketType = useCallback(editRows(setTicketTypes), []);
  const addTicketType = useCallback(() => {
    setTicketTypes((rows) => [...rows, { name: '', price: '', minutes: 0 }]);
  }, []);
  const handleDate = useCallback((index: number, row: DateRow | null) => {
    setDates((rows) => {
      const next = [...rows];
      if (row) next[index] = row;
      else next.splice(index, 1);
      return next;
    });
  }, []);
  const addDate = useCallback(() => {
    setDates((rows) => {
      const last = rows[rows.length - 1];
      return [
        ...rows,
        {
          start: '',
          end: '',
          place: last?.place ?? '',
          seats: last?.seats ?? '20',
        },
      ];
    });
  }, []);
  const handleSellHere = useCallback((value: 'here' | 'elsewhere') => {
    setSellHere(value === 'here');
  }, []);
  const handleTicketUrl = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setTicketUrl(e.currentTarget.value);
  }, []);

  const handleQuoted = useCallback((value: 'set' | 'quote') => {
    setQuoted(value === 'quote');
  }, []);
  const handleWhen = useCallback((value: 'any' | 'hours') => {
    setAnyTime(value === 'any');
  }, []);

  // The listing, as this kind of offer writes it.
  const payload = useCallback((): Partial<CreateListingParams> => {
    const base: Partial<CreateListingParams> = {
      title: title.trim(),
      description: description.trim(),
      category: 'service',
      offering,
      visibility,
      ongoing: true,
      announced,
      ...(inShop && sections.length > 0
        ? { listing_shop_section_id: sectionId || null }
        : {}),
    };

    if (offering === 'appointment') {
      const rows = lengths.map((row) => ({
        ...row,
        name: row.name.trim() || lengthLabel(intl, row.minutes),
      }));
      const one = rows.length === 1 ? rows[0] : undefined;
      const prices = rows
        .map((row) => centsOf(row.price))
        .filter((c): c is number => c !== null);
      return {
        ...base,
        price_cents: one
          ? centsOf(one.price)
          : prices.length
            ? Math.min(...prices)
            : null,
        price_currency: 'AUD',
        variants: one
          ? {}
          : {
              axes: [{ name: 'Length', values: rows.map((row) => row.name) }],
              items: rows.map((row) => ({
                values: [row.name],
                price_cents: centsOf(row.price),
                availability: 'available' as const,
              })),
            },
        options:
          where === 'either'
            ? [
                {
                  name: intl.formatMessage(messages.where),
                  choices: [
                    {
                      label: intl.formatMessage(messages.online),
                      extra_cents: 0,
                    },
                    {
                      label: intl.formatMessage(messages.inPerson),
                      extra_cents: 0,
                    },
                  ],
                },
              ]
            : [],
        booking: {
          template: 'appointment',
          parts: ['time'],
          hours,
          time_zone: TIME_ZONE,
          where,
          ...(one
            ? { minutes: one.minutes }
            : {
                lengths: Object.fromEntries(
                  rows.map((row) => [row.name, row.minutes]),
                ),
              }),
        },
      };
    }

    if (offering === 'service') {
      const rows = packages.filter((row) => row.name.trim());
      const values = [
        ...rows.map((row) => ({
          name: row.name.trim(),
          cents: centsOf(row.price),
        })),
        ...(takeQuotes
          ? [{ name: intl.formatMessage(messages.somethingElse), cents: null }]
          : []),
      ];
      const prices = values
        .map((v) => v.cents)
        .filter((c): c is number => c !== null);
      const question = ask.trim() || intl.formatMessage(messages.askService);
      return {
        ...base,
        price_cents: prices.length ? Math.min(...prices) : null,
        price_currency: 'AUD',
        options: [],
        variants:
          values.length > 0
            ? {
                axes: [{ name: 'Package', values: values.map((v) => v.name) }],
                items: values.map((v) => ({
                  values: [v.name],
                  price_cents: v.cents,
                  availability: 'available' as const,
                })),
              }
            : {},
        booking: { template: 'request', parts: ['details'], ask: question },
      };
    }

    if (offering === 'tickets') {
      const rows = ticketTypes.filter((row) => row.name.trim());
      const one = rows.length <= 1 ? (rows[0] ?? ticketTypes[0]) : undefined;
      const prices = rows
        .map((row) => centsOf(row.price))
        .filter((c): c is number => c !== null);
      return {
        ...base,
        price_cents: one
          ? centsOf(one.price)
          : prices.length
            ? Math.min(...prices)
            : null,
        price_currency: 'AUD',
        options: [],
        booking: {},
        variants: one
          ? {}
          : {
              axes: [
                { name: 'Ticket', values: rows.map((row) => row.name.trim()) },
              ],
              items: rows.map((row) => ({
                values: [row.name.trim()],
                price_cents: centsOf(row.price),
                availability: 'available' as const,
              })),
            },
        ticket_url: sellHere ? null : ticketUrl.trim(),
        ticket_dates: dates
          .filter((row) => row.start)
          .map((row) => ({
            ...(row.id ? { id: row.id } : {}),
            starts_at: fromLocal(row.start) ?? '',
            ends_at: fromLocal(row.end),
            place: row.place.trim() || null,
            seats: sellHere && row.seats ? Number(row.seats) : null,
          })),
      };
    }

    // Trip or delivery
    return {
      ...base,
      price_cents: quoted ? null : centsOf(price),
      price_currency: 'AUD',
      options: [],
      variants: {},
      booking: {
        template: 'job',
        parts: ['time', 'route', 'details'],
        ask: ask.trim() || intl.formatMessage(messages.askTrip),
        time_zone: TIME_ZONE,
        hours: anyTime ? [] : hours,
      },
    };
  }, [
    title,
    description,
    offering,
    visibility,
    announced,
    inShop,
    sections,
    sectionId,
    lengths,
    where,
    hours,
    packages,
    takeQuotes,
    ask,
    quoted,
    price,
    anyTime,
    sellHere,
    ticketUrl,
    dates,
    ticketTypes,
    intl,
  ]);

  const canSubmit =
    !loading &&
    !busy &&
    title.trim().length > 0 &&
    !photoState.uploading &&
    (offering !== 'appointment' || (lengths.length > 0 && hours.length > 0)) &&
    (offering !== 'service' ||
      takeQuotes ||
      packages.some((row) => row.name.trim())) &&
    (offering !== 'tickets' ||
      (dates.some((row) => row.start) &&
        (sellHere || /^https?:\/\/\S+$/.test(ticketUrl.trim()))));

  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);
    const fields = payload();
    void (async () => {
      try {
        if (editId) {
          await apiUpdateWachuneedListing(editId, {
            ...fields,
            ...(photoState.touched
              ? { media_attachment_ids: photoState.ids }
              : {}),
          });
          onSaved(editId);
          return;
        }
        const listing = await apiCreateWachuneedListing({
          ...fields,
          title: fields.title ?? '',
          category: 'service',
          kind: 'offer',
          state: 'live',
          ...(photoState.ids.length > 0
            ? { media_attachment_ids: photoState.ids }
            : {}),
        });
        await commitKonnect('wachuneed', listing.id);
        onSaved(listing.id);
      } catch {
        setError(intl.formatMessage(messages.error));
        setBusy(false);
      }
    })();
  }, [payload, editId, photoState, commitKonnect, onSaved, intl]);

  const handleTakeDown = useCallback(() => {
    if (!editId) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.takeDownTitle, {
          name: title.trim(),
        }),
        confirmLabel: intl.formatMessage(messages.takeDownConfirm),
        cancelLabel: intl.formatMessage(messages.takeDownCancel),
        destructive: true,
      });
      if (!ok) return;
      setBusy(true);
      try {
        await apiCloseWachuneedListing(editId);
        onSaved(null);
      } catch {
        setError(intl.formatMessage(messages.error));
        setBusy(false);
      }
    })();
  }, [confirm, editId, intl, onSaved, title]);

  const label = intl.formatMessage(OFFERING_LABEL[offering].label);

  return (
    <ComposeShell
      korner='wachuneed'
      label={label}
      subtitle={
        onChangeOffering && !editId ? (
          <button
            type='button'
            className='wachuneed-offering-change'
            onClick={onChangeOffering}
          >
            {intl.formatMessage(offeringMessages.change)}
          </button>
        ) : undefined
      }
      submitLabel={intl.formatMessage(
        editId ? messages.save : inShop ? messages.add : messages.post,
      )}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={editId ? null : konnect}
      headerAction={
        <ReachDropdown
          value={visibility}
          onChange={setVisibility}
          disabled={busy || loading}
        />
      }
    >
      {confirmDialog}
      {loading ? (
        <LoadingState label={intl.formatMessage(messages.loading)} />
      ) : (
        <>
          <ListingPhotoField state={photoState} showsChoices={[]} />

          <ComposeTitle
            value={title}
            onChange={handleTitle}
            placeholder={intl.formatMessage(messages.name)}
            aria-label={intl.formatMessage(messages.name)}
            maxLength={200}
          />

          {offering === 'appointment' && (
            <>
              <ComposeField label={intl.formatMessage(messages.lengths)}>
                <div className='wachuneed-rows'>
                  <ul className='wachuneed-rows__list'>
                    {lengths.map((row, index) => (
                      <RowEditor
                        key={index}
                        index={index}
                        row={row}
                        withMinutes
                        namePlaceholder={intl.formatMessage(
                          messages.lengthName,
                        )}
                        onChange={handleLength}
                      />
                    ))}
                  </ul>
                  {lengths.length < MAX_ROWS && (
                    <button
                      type='button'
                      className='wachuneed-rows__add'
                      onClick={addLength}
                    >
                      {intl.formatMessage(messages.addLength)}
                    </button>
                  )}
                </div>
              </ComposeField>
              <ComposeField label={intl.formatMessage(messages.where)}>
                <Pills
                  label={intl.formatMessage(messages.where)}
                  value={where}
                  onChange={setWhere}
                  options={[
                    {
                      id: 'online',
                      label: intl.formatMessage(messages.online),
                    },
                    {
                      id: 'in_person',
                      label: intl.formatMessage(messages.inPerson),
                    },
                    {
                      id: 'either',
                      label: intl.formatMessage(messages.either),
                    },
                  ]}
                />
              </ComposeField>
              <ComposeField
                label={intl.formatMessage(messages.free)}
                hint={intl.formatMessage(messages.freeHint)}
              >
                <WeeklyHoursField value={hours} onChange={setHours} />
              </ComposeField>
            </>
          )}

          {offering === 'service' && (
            <>
              <ComposeField
                label={intl.formatMessage(messages.packages)}
                hint={intl.formatMessage(messages.packageHint)}
              >
                <div className='wachuneed-rows'>
                  <ul className='wachuneed-rows__list'>
                    {packages.map((row, index) => (
                      <RowEditor
                        key={index}
                        index={index}
                        row={row}
                        withMinutes={false}
                        namePlaceholder={intl.formatMessage(
                          messages.packageName,
                        )}
                        onChange={handlePackage}
                      />
                    ))}
                  </ul>
                  {packages.length < MAX_ROWS && (
                    <button
                      type='button'
                      className='wachuneed-rows__add'
                      onClick={addPackage}
                    >
                      {intl.formatMessage(messages.addPackage)}
                    </button>
                  )}
                </div>
              </ComposeField>
              <ComposeCheck
                label={intl.formatMessage(messages.takeQuotes)}
                hint={intl.formatMessage(messages.takeQuotesHint)}
                checked={takeQuotes}
                onChange={handleTakeQuotes}
              />
              <ComposeField label={intl.formatMessage(messages.ask)}>
                <ComposeInput
                  value={ask}
                  onChange={handleAsk}
                  placeholder={intl.formatMessage(messages.askService)}
                  maxLength={120}
                />
              </ComposeField>
            </>
          )}

          {offering === 'trip' && (
            <>
              <ComposeField
                label={intl.formatMessage(messages.priceMode)}
                hint={
                  quoted
                    ? intl.formatMessage(messages.quoteEachHint)
                    : undefined
                }
              >
                <Pills
                  label={intl.formatMessage(messages.priceMode)}
                  value={quoted ? 'quote' : 'set'}
                  onChange={handleQuoted}
                  options={[
                    { id: 'set', label: intl.formatMessage(messages.setPrice) },
                    {
                      id: 'quote',
                      label: intl.formatMessage(messages.quoteEach),
                    },
                  ]}
                />
              </ComposeField>
              {!quoted && (
                <ComposeField label={intl.formatMessage(messages.price)}>
                  <ComposeInput
                    type='number'
                    min={0}
                    step={0.01}
                    inputMode='decimal'
                    value={price}
                    onChange={handlePrice}
                    placeholder='$'
                  />
                </ComposeField>
              )}
              <ComposeField
                label={intl.formatMessage(messages.when)}
                hint={
                  anyTime ? intl.formatMessage(messages.anyTimeHint) : undefined
                }
              >
                <Pills
                  label={intl.formatMessage(messages.when)}
                  value={anyTime ? 'any' : 'hours'}
                  onChange={handleWhen}
                  options={[
                    { id: 'any', label: intl.formatMessage(messages.anyTime) },
                    {
                      id: 'hours',
                      label: intl.formatMessage(messages.yourHours),
                    },
                  ]}
                />
              </ComposeField>
              {!anyTime && (
                <WeeklyHoursField value={hours} onChange={setHours} />
              )}
              <ComposeField
                label={intl.formatMessage(messages.ask)}
                hint={intl.formatMessage(messages.tripTells)}
              >
                <ComposeInput
                  value={ask}
                  onChange={handleAsk}
                  placeholder={intl.formatMessage(messages.askTrip)}
                  maxLength={120}
                />
              </ComposeField>
            </>
          )}

          {offering === 'tickets' && (
            <>
              <Pills
                label={intl.formatMessage(OFFERING_LABEL.tickets.label)}
                value={sellHere ? 'here' : 'elsewhere'}
                onChange={handleSellHere}
                options={[
                  { id: 'here', label: intl.formatMessage(messages.sellHere) },
                  {
                    id: 'elsewhere',
                    label: intl.formatMessage(messages.soldElsewhere),
                  },
                ]}
              />
              {!sellHere && (
                <ComposeField
                  label={intl.formatMessage(messages.ticketUrl)}
                  hint={intl.formatMessage(messages.elsewhereHint)}
                >
                  <ComposeInput
                    type='url'
                    value={ticketUrl}
                    onChange={handleTicketUrl}
                    placeholder='https://'
                    maxLength={400}
                  />
                </ComposeField>
              )}
              <ComposeField label={intl.formatMessage(messages.dates)}>
                <div className='wachuneed-rows'>
                  <ul className='wachuneed-rows__list'>
                    {dates.map((row, index) => (
                      <DateEditor
                         
                        key={index}
                        index={index}
                        row={row}
                        withSeats={sellHere}
                        onChange={handleDate}
                      />
                    ))}
                  </ul>
                  {dates.length < MAX_DATES && (
                    <button
                      type='button'
                      className='wachuneed-rows__add'
                      onClick={addDate}
                    >
                      {intl.formatMessage(messages.addDate)}
                    </button>
                  )}
                </div>
              </ComposeField>
              {sellHere && (
                <ComposeField
                  label={intl.formatMessage(messages.ticketTypes)}
                  hint={intl.formatMessage(messages.ticketsHint)}
                >
                  <div className='wachuneed-rows'>
                    <ul className='wachuneed-rows__list'>
                      {ticketTypes.map((row, index) => (
                        <RowEditor
                           
                          key={index}
                          index={index}
                          row={row}
                          withMinutes={false}
                          namePlaceholder={intl.formatMessage(
                            messages.ticketName,
                          )}
                          pricePlaceholder='$'
                          onChange={handleTicketType}
                        />
                      ))}
                    </ul>
                    {ticketTypes.length < MAX_ROWS && (
                      <button
                        type='button'
                        className='wachuneed-rows__add'
                        onClick={addTicketType}
                      >
                        {intl.formatMessage(messages.addTicketType)}
                      </button>
                    )}
                  </div>
                </ComposeField>
              )}
            </>
          )}

          {inShop && sections.length > 0 && (
            <ComposeField label={intl.formatMessage(messages.section)}>
              <ComposeSelect value={sectionId} onChange={handleSection}>
                <option value=''>
                  {intl.formatMessage(messages.sectionNone)}
                </option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </ComposeSelect>
            </ComposeField>
          )}

          <ComposeBody
            value={description}
            onChange={handleDescription}
            placeholder={intl.formatMessage(messages.description)}
            aria-label={intl.formatMessage(messages.description)}
            rows={3}
          />

          {inShop && !editId && (
            <ComposeCheck
              label={intl.formatMessage(messages.announce)}
              checked={announced}
              onChange={handleAnnounced}
            />
          )}

          {error && <ComposeHint error>{error}</ComposeHint>}

          {editId && (
            <button
              type='button'
              className='compose-shell__delete'
              onClick={handleTakeDown}
              disabled={busy}
            >
              {intl.formatMessage(messages.takeDown)}
            </button>
          )}
        </>
      )}
    </ComposeShell>
  );
};
