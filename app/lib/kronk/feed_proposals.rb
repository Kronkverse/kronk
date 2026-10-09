# frozen_string_literal: true

# Kommons proposals in the feed are opt-in (2026-10-09). A proposal still
# posts its feed Status, which is also its discussion thread, so the proposal
# page, replies, profiles, search and notifications are unchanged; only the
# feed columns (Home with any reach, and Kommunity) leave it out unless the
# viewer turned on `kronk.feed_show_proposals`. See docs/spaces/feed.md.
#
# Read-side on purpose: the Status stays in everyone's stored home feed, so
# turning the setting on shows proposals straight away, no regeneration.
module Kronk::FeedProposals
  SETTING = 'kronk.feed_show_proposals'

  module_function

  def show_for?(account)
    account&.user&.settings&.[](SETTING) == true
  end

  def filter(account, statuses)
    return statuses if show_for?(account)

    statuses.reject { |status| proposal?(status) }
  end

  # A boost of a proposal is a proposal card in the feed too.
  def proposal?(status)
    status.kronk_proposal? || status.reblog&.kronk_proposal?
  end
end
