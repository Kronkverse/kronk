# frozen_string_literal: true

class REST::EventSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :start_time, :end_time,
             :location_name, :location_url, :event_type, :huddle_url,
             :rsvp_enabled, :max_attendees, :recurrence_rule,
             :cancelled, :going_count, :interested_count,
             :image_url, :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :rsvp, if: :current_user?
  attribute :invited, if: :current_user?
  attribute :is_owner, if: :current_user?
  attribute :status_id
  attribute :visibility

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
    return nil unless object.image_id.present?

    object.image&.file&.url(:small)
  end

  def rsvp
    rsvp = object.rsvp_for(current_user.account)
    rsvp&.status
  end

  def invited
    object.invited?(current_user.account)
  end

  def is_owner
    object.account_id == current_user.account.id
  end

  def current_user?
    !current_user.nil?
  end
end
