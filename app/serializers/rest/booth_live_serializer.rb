# frozen_string_literal: true

class REST::BoothLiveSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :genres, :state, :room_key,
             :starts_at, :started_at, :ended_at, :is_owner, :reminded

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  # rubocop:disable Naming/PredicatePrefix -- `is_owner` is the JSON API key, as on REST::BoothSetSerializer
  def is_owner
    current_user&.account_id == object.account_id
  end
  # rubocop:enable Naming/PredicatePrefix

  # Whether the viewer asked for a Nudge when it starts. The index passes
  # the ids it looked up (`reminded_ids`) so a list is one query.
  def reminded
    return false unless current_user

    ids = instance_options[:reminded_ids]
    ids ? ids.include?(object.id) : object.reminders.exists?(account_id: current_user.account_id)
  end
end
