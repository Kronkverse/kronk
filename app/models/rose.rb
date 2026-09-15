# frozen_string_literal: true

# == Schema Information
#
# Table name: roses
#
#  id              :bigint(8)        not null, primary key
#  from_account_id :bigint(8)        not null
#  to_account_id   :bigint(8)        not null
#  sent_on         :date             not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#

# A rose: one person, one Mate, one day. No message, no reply, no count
# that outlives the day. See docs/spaces/rose.md.
class Rose < ApplicationRecord
  # The Kronk day starts at 3am Australia/Sydney, instance-wide — not at
  # each person's local 3am. Kronk is one small community in one place,
  # and a single boundary means two Mates always see the same day.
  #
  # TZInfo handles the AEST/AEDT switch; never hardcode +10.
  DAY_ZONE = 'Australia/Sydney'
  DAY_START_HOUR = 3

  belongs_to :from_account, class_name: 'Account'
  belongs_to :to_account, class_name: 'Account'

  validates :sent_on, presence: true
  validate :not_to_self

  scope :for_day, ->(day) { where(sent_on: day) }
  scope :received_by, ->(account) { where(to_account: account) }
  scope :sent_by, ->(account) { where(from_account: account) }

  class << self
    # Which Kronk day a moment belongs to. Between midnight and 3am
    # Sydney you are still in yesterday's day, which is the whole point
    # of the boundary — the stack survives a late night.
    def current_day(now = Time.current)
      local = now.in_time_zone(DAY_ZONE)
      local -= 1.day if local.hour < DAY_START_HOUR
      local.to_date
    end

    # The instant a given Kronk day began. Used by the sweep, which
    # deletes everything before the current day's start.
    def day_started_at(day = current_day)
      Time.use_zone(DAY_ZONE) do
        Time.zone.local(day.year, day.month, day.day, DAY_START_HOUR)
      end
    end

    # Today's stack for one person, in arrival order: the first rose sits
    # in the middle and each new one takes its place beside the last.
    def today_for(account)
      received_by(account).for_day(current_day).order(created_at: :asc, id: :asc)
    end
  end

  private

  def not_to_self
    errors.add(:to_account, :invalid) if from_account_id.present? && from_account_id == to_account_id
  end
end
