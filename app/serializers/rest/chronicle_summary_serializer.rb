# frozen_string_literal: true

# Trimmed shape of a Chronicle for timeline embedding on the shared
# Status. Mirrors REST::ArtPieceSummarySerializer.
class REST::ChronicleSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :kind, :visibility, :excerpt

  attribute :owner_acct

  def id
    object.id.to_s
  end

  # Longer excerpt for the feed card than the full serializer's — the
  # card is the primary discoverability surface for long-form writing,
  # so a bigger taste helps a reader decide whether to tap through.
  def excerpt
    object.excerpt(length: 360)
  end

  def owner_acct
    object.owner.acct
  end
end
