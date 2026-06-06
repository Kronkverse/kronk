# frozen_string_literal: true

class FlowCycle < ApplicationRecord
  DEFAULT_CYCLE_LENGTH = 28
  DEFAULT_PERIOD_LENGTH = 5

  belongs_to :account
  has_many :flow_cycle_shares, dependent: :destroy

  validates :started_on, presence: true
  validates :cycle_length, numericality: { greater_than: 0, less_than: 100 }, allow_nil: true
  validate :ended_on_after_started_on

  scope :recent, -> { order(started_on: :desc) }
  scope :for_account, ->(account) { where(account: account) }

  def effective_cycle_length
    cycle_length || DEFAULT_CYCLE_LENGTH
  end

  def ovulation_day
    started_on + (effective_cycle_length - 14)
  end

  def fertile_window_start
    ovulation_day - 5
  end

  def fertile_window_end
    ovulation_day + 1
  end

  def predicted_next_start
    started_on + effective_cycle_length
  end

  def current_phase(date = Date.today)
    period_end = ended_on || (started_on + DEFAULT_PERIOD_LENGTH - 1)

    if date >= started_on && date <= period_end
      'menstrual'
    elsif date < ovulation_day - 1
      'follicular'
    elsif date <= ovulation_day + 1
      'ovulation'
    else
      'luteal'
    end
  end

  def shared_with?(account)
    flow_cycle_shares.exists?(account: account)
  end

  private

  def ended_on_after_started_on
    return if ended_on.nil? || started_on.nil?

    errors.add(:ended_on, 'must be on or after start date') if ended_on < started_on
  end
end
