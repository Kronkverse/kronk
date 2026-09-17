# frozen_string_literal: true

class REST::EventSerializer < ActiveModel::Serializer
  attributes :id, :slug, :title, :description, :start_time, :end_time,
             :location_name, :location_url, :event_type, :huddle_url,
             :rsvp_enabled, :max_attendees, :recurrence_rule,
             :cancelled, :going_count, :interested_count,
             :image_url, :spawn_album, :invite_only,
             :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :rsvp, if: :current_user?
  attribute :invited, if: :current_user?
  attribute :is_owner, if: :current_user?
  attribute :status_id
  attribute :visibility
  attribute :going_preview

  def id
    object.id.to_s
  end

  def status_id
    object.status_id&.to_s
  end

  def visibility
    object.status&.visibility
  end

  def image_url
    return nil if object.image_id.blank?

    object.image&.file&.url(:small)
  end

  def rsvp
    rsvp = object.rsvp_for(current_user.account)
    rsvp&.status
  end

  def invited
    object.invited?(current_user.account)
  end

  # rubocop:disable Naming/PredicatePrefix -- `is_owner` is the JSON API key; renaming would break clients
  def is_owner
    object.account_id == current_user.account.id
  end
  # rubocop:enable Naming/PredicatePrefix

  # Up to 5 avatars of accounts who RSVP'd "going", ordered by RSVP
  # time (earliest first) so the strip is stable across renders. Feeds
  # the "who's going" preview on the status event card.
  def going_preview
    ids = object.rsvps.where(status: :going).order(:created_at).limit(5).pluck(:account_id)
    Account.where(id: ids).index_by(&:id).values_at(*ids).compact.map do |a|
      { id: a.id.to_s, acct: a.acct, avatar: a.avatar_original_url }
    end
  end

  def current_user?
    !current_user.nil?
  end
end
