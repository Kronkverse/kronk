# frozen_string_literal: true

class REST::BoothLiveSerializer < ActiveModel::Serializer
  attributes :visibility, :id, :title, :description, :genres, :state, :room_key,
             :starts_at, :started_at, :ended_at, :is_owner, :reminded, :tracklist,
             :booth_set_id

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  # rubocop:disable Naming/PredicatePrefix -- `is_owner` is the JSON API key, as on REST::BoothSetSerializer
  def is_owner
    current_user&.account_id == object.account_id
  end
  # rubocop:enable Naming/PredicatePrefix

  # The host's Now playing so far, oldest first; the last one is playing.
  # Only on a single set (`show`): a list doesn't need it.
  def tracklist
    return [] unless instance_options[:with_tracklist]

    object.tracklist
  end

  # The draft set made from its recording, for the host alone to publish.
  def booth_set_id
    object.booth_set_id&.to_s if is_owner
  end

  # Whether the viewer asked for a Nudge when it starts. The index passes
  # the ids it looked up (`reminded_ids`) so a list is one query.
  def reminded
    return false unless current_user

    ids = instance_options[:reminded_ids]
    ids ? ids.include?(object.id) : object.reminders.exists?(account_id: current_user.account_id)
  end
end
