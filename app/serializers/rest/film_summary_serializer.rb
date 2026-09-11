# frozen_string_literal: true

# Trimmed shape of a Film for timeline embedding on the shared Status.
# Mirrors REST::ArtPieceSummarySerializer / REST::ChronicleSummarySerializer.
class REST::FilmSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :visibility

  attribute :video_url
  attribute :owner_acct

  def id
    object.id.to_s
  end

  def video_url
    object.video_url
  end

  def owner_acct
    object.owner.acct
  end
end
