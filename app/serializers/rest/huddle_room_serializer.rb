# frozen_string_literal: true

# Discovery shape for one open Huddle Room. Used by
# `GET /api/v1/huddle/rooms` (list) and `POST /api/v1/huddle/rooms`
# (create). See docs/spaces/huddle.md § Three categories.
#
# Deliberately narrow — a Room in the discovery list needs its
# identity (id, name, description, icon), enough activity signal to
# help someone choose (occupancy, last_active_at), and the room key
# the client passes to Jitsi. No `host_account` on this shape: per
# the § Open decisions attribution note, "who created it" is not
# surfaced in discovery.
class REST::HuddleRoomSerializer < ActiveModel::Serializer
  attributes :id, :name, :description, :icon,
             :session_url, :occupancy,
             :last_active_at, :created_at

  def id
    object.id.to_s
  end

  def name
    object.title
  end

  # Live occupancy. `huddle_participants` gets a row per current
  # participant; ended sessions clear their rows via the leave path.
  # Falls back to 0 for a fresh Room nobody has entered yet.
  def occupancy
    object.huddle_participants.count
  end

  def last_active_at
    object.last_active_at&.iso8601
  end

  def created_at
    object.created_at.iso8601
  end
end
