# frozen_string_literal: true

# Who follows which Kuddle (a Huddle Room; docs/spaces/huddle.md, Following
# a Kuddle).
#
# Three ways to follow one:
#
#   * make it: HuddleRoom::CreateService follows it for its maker;
#   * press Follow: a HuddleFollow row with `following: true`;
#   * be in a Krew it is Konnected to. Worked out from membership, never
#     stored per person, so joining the Krew is enough and leaving it is
#     too. Only a link its maker made counts, to a live Krew the maker is
#     in, as with every Krew link that shares (decisions.md, 2026-10-27,
#     "Konnect shares only what its owner chose"): a link anyone else makes
#     stays a link, and can't sign a whole Krew up for nudges.
#
# Unfollow is stored too (`following: false`), on any Kuddle: it is what
# stops a Krew member, and it keeps them stopped if the Kuddle is Konnected
# to another of their Krews later. Follow again turns the row back.
module Huddle
  module Follows
    module_function

    def follow!(account, room)
      choose!(account, room, following: true)
    end

    def unfollow!(account, room)
      choose!(account, room, following: false)
    end

    # { room_id => { followed:, via_krew: } } for `account`. `via_krew` says
    # the Kuddle is one of their Krews', whatever they chose.
    def state_for(account, rooms)
      ids = rooms.map(&:id)
      return {} if account.nil? || ids.empty?

      chosen = HuddleFollow.where(account_id: account.id, huddle_session_id: ids).pluck(:huddle_session_id, :following).to_h
      links  = krew_links(ids)
      mine   = KrewMembership.where(account_id: account.id, krew_id: links.values.flatten.uniq).pluck(:krew_id).to_set

      ids.index_with do |id|
        via_krew = links.fetch(id, []).any? { |krew_id| mine.include?(krew_id) }
        { followed: chosen.fetch(id, via_krew), via_krew: via_krew }
      end
    end

    def followed?(account, room)
      state_for(account, [room]).dig(room.id, :followed) || false
    end

    # Account ids of everyone following `room`.
    def follower_ids(room)
      rows     = HuddleFollow.where(huddle_session_id: room.id).pluck(:account_id, :following)
      chosen   = rows.select(&:last).map(&:first)
      declined = rows.reject(&:last).to_set(&:first)
      krew     = KrewMembership.where(krew_id: krew_links([room.id]).fetch(room.id, [])).pluck(:account_id)

      (chosen + krew).uniq.reject { |id| declined.include?(id) }
    end

    # Open Kuddles someone might be following (a Follow row, or a Krew link
    # of its maker's), most recently active first, at most `limit`. Only
    # Kuddles whose Jitsi room key is a plain key: rows backfilled from old
    # Kalendar events can hold a whole URL, which the count can't ask about.
    def watched_rooms(limit:)
      kuddles  = HuddleSession.rooms.not_retired
      followed = HuddleFollow.following.select(:huddle_session_id)
      linked   = krew_links(linked_room_ids).keys

      kuddles.where(id: followed)
             .or(kuddles.where(id: linked))
             .where("session_url ~ '^[a-z0-9-]+$'")
             .order(Arel.sql('last_active_at DESC NULLS LAST'))
             .limit(limit)
    end

    # { room_id => [krew_id, …] }: the live Krews each Kuddle's maker
    # Konnected it to, and is in. Links are made from either end.
    def krew_links(room_ids)
      room_ids = Array(room_ids)
      return {} if room_ids.empty?

      makers = HuddleSession.where(id: room_ids).pluck(:id, :host_account_id).to_h
      pairs  = linked_pairs(room_ids).select { |room_id, _krew_id, by| makers[room_id] == by }
      return {} if pairs.empty?

      live      = Krew.active.where(id: pairs.map(&:second).uniq).pluck(:id).to_set
      makers_in = KrewMembership.where(krew_id: live.to_a, account_id: pairs.map(&:third).uniq).pluck(:krew_id, :account_id).to_set

      pairs.each_with_object({}) do |(room_id, krew_id, by), map|
        next unless live.include?(krew_id) && makers_in.include?([krew_id, by])

        (map[room_id] ||= []) << krew_id unless map[room_id]&.include?(krew_id)
      end
    end

    # [room_id, krew_id, made_by] for each link between these Kuddles and a Krew.
    def linked_pairs(room_ids)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)

      links.where(source_slug: 'huddle', source_id: room_ids, target_slug: 'krew').pluck(:source_id, :target_id, :created_by_account_id) +
        links.where(source_slug: 'krew', target_slug: 'huddle', target_id: room_ids).pluck(:target_id, :source_id, :created_by_account_id)
    end

    # Open Kuddles with any link to a Krew.
    def linked_room_ids
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      ids   = links.where(source_slug: 'huddle', target_slug: 'krew').distinct.pluck(:source_id) +
              links.where(source_slug: 'krew', target_slug: 'huddle').distinct.pluck(:target_id)

      HuddleSession.rooms.not_retired.where(id: ids.uniq).pluck(:id)
    end

    def choose!(account, room, following:)
      follow = HuddleFollow.find_or_initialize_by(account_id: account.id, huddle_session_id: room.id)
      follow.update!(following: following)
      follow
    rescue ActiveRecord::RecordNotUnique
      retry
    end
  end
end
