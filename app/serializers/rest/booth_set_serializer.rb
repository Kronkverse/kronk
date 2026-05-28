# frozen_string_literal: true

class REST::BoothSetSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :artist_name, :event_name, :event_date,
             :genre, :duration_seconds, :play_count, :audio_url, :cover_url,
             :published, :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :is_owner, if: :current_user?

  def id
    object.id.to_s
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
