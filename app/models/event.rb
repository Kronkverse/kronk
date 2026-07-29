# frozen_string_literal: true

class Event < ApplicationRecord
  include Searchable

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
  # Kalendar → Albutts: if the event was created with `spawn_album`, this is
  # the Albutt bound to it. Wired in Slice 3 of the Albutts build.
  has_one :spawned_album, class_name: 'Album', dependent: :nullify, inverse_of: :event

  has_many :going_accounts, -> { where(event_rsvps: { status: :going }) }, through: :rsvps, source: :account
  has_many :interested_accounts, -> { where(event_rsvps: { status: :interested }) }, through: :rsvps, source: :account

  enum :event_type, { event: 0, huddle: 1 }, prefix: true

  validates :title, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5000 }
  validates :start_time, presence: true
  validates :location_name, length: { maximum: 200 }
  validates :location_url, length: { maximum: 400 }
  validate :end_time_after_start_time

  scope :upcoming, -> { where('start_time > ?', Time.now.utc).order(start_time: :asc) }
  scope :past, -> { where(start_time: ..Time.now.utc).order(start_time: :desc) }
  scope :in_month, ->(date) { where(start_time: date.all_month) }
  scope :not_cancelled, -> { where(cancelled: false) }
  scope :root_events, -> { where(parent_event_id: nil) }

  after_create_commit :publish_kalendar_event_created

  # kalendar.event.created — declared under Kalendar's `emits:` in the
  # manifest; consumed by Huddle to attach event metadata to sessions,
  # and by Albutts to spawn a companion album when `spawn_album` is
  # set. Payload deliberately narrow: just IDs, so subscribers reload
  # as needed (avoids stale-payload issues on multi-step edits).
  def publish_kalendar_event_created
    Kronk::KornerEvents.publish(
      'kalendar.event.created',
      event_id: id,
      account_id: account_id,
      event_type: event_type,
      spawn_album: spawn_album,
      huddle_session_id: try(:huddle_session_id)
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

  def recurring?
    recurrence_rule.present?
  end

  def image_url
    image&.file&.url(:small)
  end
end
