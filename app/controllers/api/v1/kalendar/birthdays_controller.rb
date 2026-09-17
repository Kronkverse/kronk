# frozen_string_literal: true

# Upcoming birthdays of the viewer's Mates, synthesized at read time from
# their `birthday` profile field (no stored events — so it's naturally
# mate-scoped and always current). Powers the Kalendar "Birthdays" face.
class Api::V1::Kalendar::BirthdaysController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  WINDOW_DAYS = 90
  ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/

  def index
    render json: upcoming
  end

  private

  def upcoming
    today    = Time.zone.today
    mate_ids = current_account.mates.where(domain: nil).select(:id)

    entries = ProfileCard.where(card_type: 'birthday', account_id: mate_ids)
                         .shown.includes(:account).filter_map do |card|
      next unless card.visible_to?(current_account)

      match = ISO_DATE.match(card.body)
      next unless match

      date = next_occurrence(today, match[2].to_i, match[3].to_i)
      next unless date

      days = (date - today).to_i
      next if days.negative? || days > WINDOW_DAYS

      { account: card.account, date: date, days: days }
    end

    entries.sort_by { |entry| entry[:days] }.map do |entry|
      {
        account: REST::AccountSerializer.new(entry[:account], scope: current_user, scope_name: :current_user).as_json,
        date: entry[:date].iso8601,
        days_until: entry[:days],
      }
    end
  end

  # This year's occurrence of the month/day, or next year's if it has passed.
  def next_occurrence(today, month, day)
    [today.year, today.year + 1].each do |year|
      candidate = build_date(year, month, day)
      return candidate if candidate && candidate >= today
    end
    nil
  end

  def build_date(year, month, day)
    Date.new(year, month, day)
  rescue ArgumentError
    # Feb 29 on a non-leap year — mark it on the 28th; other invalid dates
    # (e.g. a garbage body) are dropped.
    Date.new(year, 2, 28) if month == 2 && day == 29
  end
end
