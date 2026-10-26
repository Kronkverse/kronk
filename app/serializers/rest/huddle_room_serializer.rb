# frozen_string_literal: true

# Discovery shape for one open Huddle Room. Used by
# `GET /api/v1/huddle/rooms` (list) and `POST /api/v1/huddle/rooms`
# (create). See docs/spaces/huddle.md § Three categories.
#
# Deliberately narrow — a Room in the discovery list needs its
# identity (id, name, description), enough activity signal to
# help someone choose (occupancy, last_active_at), and the room key
# the client passes to Jitsi. No `host_account` on this shape: per
# the § Open decisions attribution note, "who created it" is not
# surfaced in discovery. `is_host` tells viewers only about themselves,
# so the host can manage what the Room is attached to. No icon: Rooms
# don't carry one any more (the column stays, unread; decisions.md,
# 2026-10-22), so an emoji kept on an older Room isn't sent.
class REST::HuddleRoomSerializer < ActiveModel::Serializer
  attributes :id, :name, :description,
             :session_url, :occupancy,
             :last_active_at, :created_at

  attribute :is_host, if: :current_user?

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

  # Who looks after the Room, by the same rule attaching uses.
  # rubocop:disable Naming/PredicatePrefix -- `is_host` is the JSON API key
  def is_host
    Kronk::KornerRecords.looked_after_by?(object, current_user.account)
  end
  # rubocop:enable Naming/PredicatePrefix

  def current_user?
    !current_user.nil?
  end
end
