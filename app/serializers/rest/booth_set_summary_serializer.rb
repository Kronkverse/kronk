# frozen_string_literal: true

# Trimmed shape of a BoothSet for timeline embedding on the shared status.
# The full REST::BoothSetSerializer includes account, play_count, timestamps
# etc. which we don't need to ship on every status. Mirrors
# REST::WachuneedListingSummarySerializer and REST::ProposalSummarySerializer.
class REST::BoothSetSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :artist_name, :genres, :duration_seconds, :cover_url, :event_name

  def id
    object.id.to_s
  end

  def cover_url
    object.cover_url
  end
end
