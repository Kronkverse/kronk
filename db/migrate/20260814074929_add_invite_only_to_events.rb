# frozen_string_literal: true

# Kalendar — private events. A boolean flag on the event row; when
# true the event is visible only to its author + accounts in the
# `event_invitations` join table (see EventPolicy / Event#visible_to?
# once they land). The associated Status is created at
# `visibility=self_only` so nothing fans out to feeds — invitees
# discover the event via the invitation nudge, not the timeline.
#
# Design rationale in docs/kronk_feed_and_reach.md §2: the distance
# ladder (Mates → Orbit → Kronkverse) governs feed reach; "invite-only"
# is a different axis — explicit per-event access, not distance — so
# it lives as its own boolean rather than a new reach tier.
#
# Nullable + defaulted to false so existing events (all public today)
# aren't disturbed.
class AddInviteOnlyToEvents < ActiveRecord::Migration[8.0]
  def change
    add_column :events, :invite_only, :boolean, null: false, default: false
  end
end
