# frozen_string_literal: true

# Rose::SendService — one tap, one rose, one day.
#
# Everything the feature refuses lives here: not a Mate, no rose; already
# sent today, no second rose; yourself, no rose. There is no payload to
# validate because there is nothing attached to a rose.
#
# Namespaced under the model (`class Rose`, not `module Rose`) because the
# model owns that constant.
#
# Returns the Rose on success and raises one of the errors below
# otherwise, so the controller can answer with the right status without
# re-deriving why.
class Rose
  class SendService
    class Error < StandardError; end
    # Not Mates (or no longer Mates). Mates-only is the whole
    # permission model — docs/spaces/rose.md § Rules.
    class NotMatesError < Error; end
    # A rose from this person to that person already exists today. The
    # DB unique index is the real guard; this is the friendly path.
    class AlreadySentError < Error; end

    def initialize(from_account, to_account)
      @from_account = from_account
      @to_account = to_account
    end

    def call
      raise NotMatesError if @from_account.nil? || @to_account.nil?
      raise NotMatesError if @from_account.id == @to_account.id
      raise NotMatesError unless @from_account.mate?(@to_account)

      Rose.create!(
        from_account: @from_account,
        to_account: @to_account,
        sent_on: Rose.current_day
      )
    rescue ActiveRecord::RecordNotUnique
      # The index did its job — someone double-tapped, or two devices
      # sent at once. Not an error worth alarming anybody about.
      raise AlreadySentError
    end
  end
end
