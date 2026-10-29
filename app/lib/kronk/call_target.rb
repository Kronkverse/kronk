# frozen_string_literal: true

# One call Kronk runs on Jitsi: the Main Huddle, a Kuddle or a Booth live set
# (docs/decisions.md, 2026-10-27, "Kronk's own Jitsi"). Who may join it, who
# moderates it, who sees its recordings, and its Jitsi room name,
# in one place, for passes (Api::V1::Calls::TokensController) and recordings
# (CallRecording, CallRecordingPolicy).
#
#   * Main Huddle: every signed-in member (the page asks for nothing more;
#     tuning out of Huddle quiets its feed and nudges, not the room).
#     Moderated by staff. Recordings: every signed-in member.
#   * Kuddle: open to everyone signed in while it isn't retired (a retired
#     one isn't there). Moderated by its maker and staff. Recordings: whoever
#     can see the Kuddle.
#   * Booth live set: whoever its reach allows (BoothLive#visible_to?), while
#     it is live; its host from when it's planned until it ends. Moderated by
#     the host and staff. Its recording is the host's to publish as a set, so
#     only the host and staff see it.
module Kronk
  class CallTarget
    KINDS = %w(huddle kuddle booth_live).freeze

    attr_reader :kind, :record

    # The target for a kind and id from a request; RecordNotFound for
    # anything that isn't one.
    def self.find!(kind, id = nil)
      case kind.to_s
      when 'huddle' then new('huddle', nil)
      when 'kuddle' then new('kuddle', HuddleSession.rooms.not_retired.find(id))
      when 'booth_live' then new('booth_live', BoothLive.find(id))
      else raise ActiveRecord::RecordNotFound
      end
    end

    # The target a Jitsi room name belongs to, or nil. Retired Kuddles and
    # ended live sets still count: a recording is uploaded after the call.
    def self.for_room(name)
      key = Kronk::Jitsi.room_key(name)
      return nil if key.nil?
      return new('huddle', nil) if key == Kronk::Jitsi::MAIN_ROOM

      if (live = BoothLive.find_by(room_key: key))
        new('booth_live', live)
      elsif (kuddle = HuddleSession.rooms.find_by(session_url: key))
        new('kuddle', kuddle)
      end
    end

    # The target a recording belongs to.
    def self.for_recording(recording)
      case recording.kind
      when 'huddle' then new('huddle', nil)
      when 'kuddle' then new('kuddle', recording.huddle_session)
      when 'booth_live' then new('booth_live', recording.booth_live)
      end
    end

    def initialize(kind, record)
      @kind = kind
      @record = record
    end

    def id
      record&.id
    end

    def room_key
      case kind
      when 'huddle' then Kronk::Jitsi::MAIN_ROOM
      when 'kuddle' then record.session_url
      when 'booth_live' then record.room_key
      end
    end

    def room_name
      Kronk::Jitsi.room_name(room_key)
    end

    def visible_to?(account)
      return false if account.nil?

      case kind
      when 'huddle' then true
      when 'kuddle' then !record.retired?
      when 'booth_live' then record.visible_to?(account)
      else false
      end
    end

    # May `account` have a pass into the call now?
    def joinable_by?(account)
      return false unless visible_to?(account)
      return true unless kind == 'booth_live'

      record.live? || (host?(account) && !record.ended?)
    end

    def moderator?(account)
      return false if account.nil?

      host?(account) || staff?(account)
    end

    def recordings_visible_to?(account)
      return moderator?(account) if kind == 'booth_live'

      visible_to?(account)
    end

    private

    def host?(account)
      case kind
      when 'kuddle' then record.host_account_id == account.id
      when 'booth_live' then record.account_id == account.id
      else false
      end
    end

    def staff?(account)
      account.user&.role&.can?(:manage_reports) || false
    end
  end
end
