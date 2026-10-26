# frozen_string_literal: true

# A record whose audience another can follow, or that follows another's
# ("Same as", Kronk::Audience). When its reach changes, the records
# following it take the change; when its owner changed it by hand, its own
# follow ends. Kronk::Audience tells a change a follow made from the
# owner's.
#
# An album's Krews change through `album_krews`, which tell it the same way
# (AlbumKrew). An event's audience is its post's, so Kronk::EventLinks and
# the events controller tell Kronk::Audience themselves.
module Kronk
  module AudienceBearer
    extend ActiveSupport::Concern

    included do
      after_update :kronk_audience_changed, if: :saved_change_to_visibility?
    end

    private

    def kronk_audience_changed
      Kronk::Audience.changed(self)
    end
  end
end
