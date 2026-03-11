# frozen_string_literal: true

class Event < ApplicationRecord
  belongs_to :account
  belongs_to :status, optional: true
  belongs_to :parent_event, class_name: 'Event', optional: true
  belongs_to :image, class_name: 'MediaAttachment', optional: true

  has_many :rsvps, class_name: 'EventRsvp', inverse_of: :event, dependent: :destroy
  has_many :invitations, class_name: 'EventInvitation', inverse_of: :event, dependent: :destroy
  has_many :occurrences, class_name: 'Event', foreign_key: 'parent_event_id', inverse_of: :parent_event, dependent: :destroy

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
  scope :past, -> { where('start_time <= ?', Time.now.utc).order(start_time: :desc) }
  scope :in_month, ->(date) { where(start_time: date.beginning_of_month..date.end_of_month) }
  scope :not_cancelled, -> { where(cancelled: false) }
  scope :root_events, -> { where(parent_event_id: nil) }

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
