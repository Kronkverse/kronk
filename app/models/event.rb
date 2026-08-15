# frozen_string_literal: true

class Event < ApplicationRecord
  include Searchable
  # KornerAttachment source (docs/kronk_korner_attachments.md). The
  # manifest at `config/korners/kalendar.yaml` declares two `attaches:`
  # entries — spawn → albutts (field:spawn_album) + link → booth.
  # `Kronk::AttachmentSource` fires the spawn factory on create and
  # cascades the join rows on destroy.
  include Kronk::AttachmentSource

  self.attachment_source_slug = 'kalendar'

  searchable_as :kalendar_events

  def as_json_for_search
    {
      id: id,
      title: title.to_s,
      description: description.to_s,
      location_name: location_name.to_s,
      host_acct: account&.acct.to_s,
      account_id: account_id,
      starts_at: start_time&.to_i,
      ends_at: end_time&.to_i,
    }
  end

  belongs_to :account
  belongs_to :status, optional: true
  belongs_to :parent_event, class_name: 'Event', optional: true
  belongs_to :image, class_name: 'MediaAttachment', optional: true

  has_many :rsvps, class_name: 'EventRsvp', inverse_of: :event, dependent: :destroy
  has_many :invitations, class_name: 'EventInvitation', inverse_of: :event, dependent: :destroy
  has_many :occurrences, class_name: 'Event', foreign_key: 'parent_event_id', inverse_of: :parent_event, dependent: :destroy
  # `has_one :spawned_album` retired 2026-08-14 alongside the
  # `albums.event_id` FK drop — the Kalendar → Albutts link now lives
  # in `korner_attachments` (docs/kronk_korner_attachments.md Phase 5).
  # `Kronk::AttachmentSource#cleanup_kronk_attachments` handles the
  # cascade-delete on Event#destroy that `dependent: :nullify` used to
  # provide, so no Album is orphaned.

  has_many :going_accounts, -> { where(event_rsvps: { status: :going }) }, through: :rsvps, source: :account
  has_many :interested_accounts, -> { where(event_rsvps: { status: :interested }) }, through: :rsvps, source: :account

  enum :event_type, { event: 0, huddle: 1 }, prefix: true

  # Slugs that would collide with static routes under `/hub/kalendar/*`
  # (WrappedRoute list in features/ui/index.jsx). If someone titles
  # their event "Composer" or "New", the slug gets a `-1` suffix so
  # the URL doesn't shadow the reserved path.
  RESERVED_SLUGS = %w(composer new list settings).freeze

  validates :title, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5000 }
  validates :start_time, presence: true
  validates :location_name, length: { maximum: 200 }
  validates :location_url, length: { maximum: 400 }
  validates :slug, presence: true, uniqueness: true, length: { maximum: 200 }
  validate :end_time_after_start_time

  before_validation :assign_slug, on: :create

  scope :upcoming, -> { where('start_time > ?', Time.now.utc).order(start_time: :asc) }
  scope :past, -> { where(start_time: ..Time.now.utc).order(start_time: :desc) }
  scope :in_month, ->(date) { where(start_time: date.all_month) }
  scope :not_cancelled, -> { where(cancelled: false) }
  scope :root_events, -> { where(parent_event_id: nil) }

  # SQL-side counterpart to Event#visible_to? for list queries
  # (e.g. `EventsController#index`). Anonymous callers get nothing —
  # every read endpoint requires a login anyway. Row-level rule:
  #
  #   NOT invite_only  → visible (author + status-reach check
  #                      handled at row rendering time, if we ever
  #                      tighten non-invite-only reads)
  #   invite_only      → visible iff caller is author OR has an
  #                      invitation row
  #
  # The subquery on event_invitations avoids materialising a join
  # (LEFT OUTER + DISTINCT would work but is slower on Postgres for
  # events with a lot of invitees).
  scope :visible_to, lambda { |account|
    return none if account.nil?

    invited_event_ids = EventInvitation.where(account: account).select(:event_id)
    where(invite_only: false).or(
      where(account: account)
    ).or(
      where(id: invited_event_ids)
    )
  }

  after_create_commit :publish_kalendar_event_created

  # kalendar.event.created — declared under Kalendar's `emits:` in the
  # manifest. No korner currently subscribes — Albutts moved to the
  # KornerAttachment factory in Phase 3 and Huddle to the Phase 6
  # `accepts:` opt-in, so the payload is thin now. Kept for external
  # observability + as an extension point for future subscribers.
  # `huddle_session_id` dropped from the payload in Phase 6b (the
  # `events.huddle_session_id` FK is gone; the link lives in
  # `korner_attachments`).
  def publish_kalendar_event_created
    Kronk::KornerEvents.publish(
      'kalendar.event.created',
      event_id: id,
      account_id: account_id,
      event_type: event_type,
      spawn_album: spawn_album
    )
  end

  def end_time_after_start_time
    return if end_time.blank? || start_time.blank?

    errors.add(:end_time, 'must be after start time') if end_time <= start_time
  end

  def live?
    event_type_huddle? && start_time <= Time.now.utc && (end_time.nil? || end_time > Time.now.utc)
  end

  def ended?
    end_time.present? && end_time <= Time.now.utc
  end

  def rsvp_for(account)
    rsvps.find_by(account: account)
  end

  def invited?(account)
    invitations.exists?(account: account)
  end

  # Access rule (Tal 2026-08-14: "Events should have the option to
  # be only visible to those who are invited, private events
  # essentially"):
  #
  # - Author can always see their own event.
  # - Invitees (anyone in `event_invitations`) can always see the
  #   event, regardless of the reach on its associated Status.
  # - When `invite_only` is set, those two are the ONLY viewers —
  #   the underlying Status is `self_only`, so nothing fans out to
  #   feeds; the event is discovered via the invitation nudge.
  # - When `invite_only` is not set, non-author non-invitee viewers
  #   fall back to whatever the Status permits. If there's no
  #   Status (e.g. `post_to_feed=false` was passed on create), the
  #   event is effectively author + invitees only, same as
  #   invite_only.
  #
  # Anonymous access is off — every event endpoint requires a login
  # (see EventsController#require_user!).
  def visible_to?(account)
    return false if account.nil?
    return true if account_id == account.id
    return true if invited?(account)
    return false if invite_only?
    return false if status.nil?

    StatusPolicy.new(account, status).show?
  end

  def recurring?
    recurrence_rule.present?
  end

  def image_url
    image&.file&.url(:small)
  end

  # Autofill `slug` from the title on create. Nothing on update — a
  # slug change would break existing URLs (bookmarks, shared links,
  # embed frames in nudges). Editing the title leaves the slug
  # intact.
  #
  # Race: two concurrent creates picking the same base slug can both
  # see "cold-plunge" as free and both write it; the unique index
  # catches the second one at save time (RecordInvalid on slug). Bump
  # the suffix once and retry in the controller if we start seeing
  # these; for MVP the frequency is too low to bother.
  def assign_slug
    return if slug.present?

    base = title.to_s.parameterize
    base = 'event' if base.blank?
    base = base.slice(0, 200)
    candidate = base
    candidate = "#{base}-1" if RESERVED_SLUGS.include?(candidate)

    n = 1
    while Event.where.not(id: id).exists?(slug: candidate)
      n += 1
      candidate = "#{base}-#{n}"
    end

    self.slug = candidate
  end
end
