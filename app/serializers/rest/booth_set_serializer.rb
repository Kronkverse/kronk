# frozen_string_literal: true

class REST::BoothSetSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :artist_name, :event_id, :event_name, :event_date,
             :genres, :duration_seconds, :play_count, :audio_url, :cover_url,
             :cover_offset_y, :published, :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :is_owner, if: :current_user?

  def id
    object.id.to_s
  end

  def event_id
    object.event_id&.to_s
  end

  def event_date
    object.event_date&.strftime('%Y-%m-%d')
  end

  def audio_url
    object.audio_url
  end

  def cover_url
    object.cover_url
  end

  def is_owner
    object.account_id == current_user.account.id
  end

  def current_user?
    !current_user.nil?
  end
end
