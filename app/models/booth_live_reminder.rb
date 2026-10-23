# frozen_string_literal: true

# "Remind me" on a scheduled live set: the member gets the "is live" nudge
# when the host goes live (Booth::LiveNotifier), even if they tuned out of
# the Booth or turned that row off, since they asked.
class BoothLiveReminder < ApplicationRecord
  belongs_to :account
  belongs_to :booth_live, inverse_of: :reminders

  validates :booth_live_id, uniqueness: { scope: :account_id }
end
