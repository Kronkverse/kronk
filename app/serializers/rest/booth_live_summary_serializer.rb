# frozen_string_literal: true

# A live set as its post's feed card draws it (StatusBoothLiveCard): what it
# is and when, never the room key, which is the way into the room.
class REST::BoothLiveSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :state, :starts_at, :started_at, :genres

  def id
    object.id.to_s
  end
end
