# frozen_string_literal: true

# Kronk Huddle — its own korner in 2.0.0. A live video session with an
# optional schedule, an optional linked Kalendar event, and its own
# participants log. Feed projection lands via the canonical status_id
# per §5.5 when a huddle wants to appear in the timeline.
class HuddleSession < ApplicationRecord
  STATES = %w(draft scheduled live ended).freeze

  belongs_to :host_account, class_name: 'Account'
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :huddle_session
  has_one    :event, dependent: :nullify
  has_many   :huddle_participants, dependent: :destroy
  has_many   :participants, through: :huddle_participants, source: :account

  validates :title, presence: true, length: { maximum: 200 }
  validates :session_url, presence: true, length: { maximum: 400 }
  validates :state, inclusion: { in: STATES }

  scope :live,        -> { where(state: 'live') }
  scope :scheduled,   -> { where(state: 'scheduled') }
  scope :upcoming,    -> { where('scheduled_start > ?', Time.now.utc).order(scheduled_start: :asc) }

  def live?
    state == 'live'
  end

  def ended?
    state == 'ended'
  end

  def start!
    return false if live? || ended?

    update!(state: 'live', ended_at: nil)
    Kronk::KornerEvents.publish('huddle.started', huddle_session_id: id, host_account_id: host_account_id)
    true
  end

  def end!
    return false unless live?

    update!(state: 'ended', ended_at: Time.current)
    Kronk::KornerEvents.publish('huddle.ended', huddle_session_id: id, host_account_id: host_account_id)
    true
  end
end
