# frozen_string_literal: true

# Who can see a record, read and written the same way for every korner that
# has an audience, so one record can take its audience from another: "Same
# as <that event>" (decisions.md, 2026-10-25, Konnections carry audience).
#
# An audience is `{ tier:, krew_ids: }`: a rung of the reach ladder
# (`public` / `mates` / `orbit` / `self_only`) plus the Krews that see it
# on top (Reachable). Each korner has an adapter below that reads and writes
# it through the model's own columns and joins, so visibility checks and
# the SQL scopes keep working unchanged.
#
# **Following.** A Konnection (a `link` row in `korner_attachments`) can say
# that one end's audience follows the other's: `metadata['audience_follows']`
# names the end that leads, `'target'` (the source follows the target) or
# `'source'` (the target follows the source). A record follows at most one
# leader. Its audience is copied when the follow is set and again whenever
# the leader's changes, down a chain of followers (MAX_DEPTH, and never the
# same record twice). Taking the flag off, or Diskonnecting, stops it; the
# record keeps the audience it has. Its owner changing the audience by hand
# stops it too (`changed`).
#
# **What can be followed** (`followable?`): an audience of Everyone, or one
# for Krews alone (`self_only` with Krews). Mates and Orbit are relative to
# the leader's owner, so nobody else's record can have them; an invite-only
# event, or a record for its owner alone, is the same. A Booth set is
# always public and is never followed or a follower.
#
# **Copying never widens.** What a follower is given (`fit`) is the
# leader's audience as far as the follower can carry it: Krews only the
# follower's owner is in.
# When the leader stops being followable (it goes Mates-only, say), its
# followers are held at `self_only` until it is followable again. Setting a
# follow is stricter (`follow_error`): it is refused unless the follower
# can carry the whole audience, so "Same as" never says more than it does.
module Kronk
  module Audience
    TIERS = %w(public mates orbit self_only).freeze
    MAX_DEPTH = 5
    FOLLOWS_KEY = 'audience_follows'
    ENDS = %w(source target).freeze
    STATE = :kronk_audience

    # The reach ladder alone, on a model with a `visibility` enum; the base
    # of the adapters below.
    class Reach
      def self.krews?
        false
      end

      def self.read(record)
        { tier: record.visibility.to_s, krew_ids: [] }
      end

      def self.read_many(records)
        records.to_h { |record| [record.id, read(record)] }
      end

      # Why `record` keeps an audience of its own and can't follow, or nil.
      def self.fixed_reason(_record)
        nil
      end

      def self.leads?
        true
      end

      # Whether a record here can follow another's audience at all.
      def self.follows?
        true
      end

      def self.write(record, tier:, krew_ids: nil) # rubocop:disable Lint/UnusedMethodArgument
        record.update!(visibility: tier) unless record.visibility.to_s == tier
      end

      def self.followable?(audience)
        audience[:tier] == 'public' || (audience[:tier] == 'self_only' && audience[:krew_ids].any?)
      end
    end

    # The reach ladder plus Krews kept in `record_krews`
    # (Kronk::KrewAudience): Cinema, Karporn, Kronikles, Art.
    class KrewReach < Reach
      def self.krews?
        true
      end

      def self.read(record)
        { tier: record.visibility.to_s, krew_ids: record.record_krews.map(&:krew_id).sort }
      end

      def self.read_many(records)
        slug = records.first.class.attachment_source_slug
        krews = RecordKrew.where(korner_slug: slug, record_id: records.map(&:id)).pluck(:record_id, :krew_id).group_by(&:first)
        records.to_h { |record| [record.id, { tier: record.visibility.to_s, krew_ids: Array(krews[record.id]).map(&:last).sort }] }
      end

      # `krew_ids: nil` leaves the Krews as they are.
      def self.write(record, tier:, krew_ids: nil)
        super
        record.sync_audience_krews!(krew_ids) unless krew_ids.nil?
      end
    end

    # A listing's feed card moves with its reach, as on the seller's edit.
    class ListingReach < KrewReach
      def self.write(record, tier:, krew_ids: nil)
        before = record.visibility
        super
        Wachuneed::PublishListing.new(record).rescope(before: before)
      end
    end

    # An album: its reach and its Krews (`album_krews`), each Krew a
    # Konnection to it (Kronk::AlbumLinks). A Krew album's audience is its
    # Krew's, so it leads but never follows.
    class Album < Reach
      def self.krews?
        true
      end

      def self.read(record)
        { tier: record.visibility.to_s, krew_ids: record.album_krews.map(&:krew_id).sort }
      end

      def self.read_many(records)
        krews = AlbumKrew.where(album_id: records.map(&:id)).pluck(:album_id, :krew_id).group_by(&:first)
        records.to_h { |album| [album.id, { tier: album.visibility.to_s, krew_ids: Array(krews[album.id]).map(&:last).sort }] }
      end

      def self.fixed_reason(album)
        "a Krew album's audience is its Krew's" if album.krew_album?
      end

      # `krew_ids: nil` leaves the Krews as they are.
      def self.write(album, tier:, krew_ids: nil)
        before = album.visibility
        album.update!(visibility: tier) unless before.to_s == tier
        Albutts::RescopeAlbum.new(album, before: before).call
        return if krew_ids.nil?

        current = album.album_krews.pluck(:krew_id)
        album.album_krews.where(krew_id: current - krew_ids).destroy_all
        (krew_ids - current).each { |krew_id| album.album_krews.create!(krew_id: krew_id) }
        Kronk::StatusKrews.add(album.post_status_ids, krew_ids - current)
        Kronk::StatusKrews.remove(album.post_status_ids, current - krew_ids)
        # The Krew page lists albums under its Albutts space (as AlbumLinks.share).
        Krew.where(id: krew_ids - current).find_each { |krew| krew.krew_korners.find_or_create_by!(korner: 'albutts') }
      end
    end

    # An event's audience is its post's: the post's reach and Krews
    # (`statuses_krews`), widened by its invitees. It is set when the event
    # is posted, so an event leads but never follows. Invite-only, or never
    # posted, it is for its maker and invitees: not followable.
    class Event < Reach
      def self.krews?
        true
      end

      STATUS_TIERS = { 'public' => 'public', 'unlisted' => 'public', 'mates' => 'mates', 'orbit' => 'orbit' }.freeze

      def self.read(event)
        read_many([event])[event.id]
      end

      def self.read_many(events)
        status_ids = events.filter_map(&:status_id)
        statuses = Status.where(id: status_ids).pluck(:id, :visibility).to_h
        krews = Status.where(id: status_ids).joins(:krews).pluck(:id, 'krews.id').group_by(&:first)
        events.to_h do |event|
          visibility = statuses[event.status_id]
          if event.invite_only? || visibility.nil?
            [event.id, { tier: 'self_only', krew_ids: [], invitees: true }]
          else
            [event.id, { tier: STATUS_TIERS.fetch(visibility.to_s, 'self_only'), krew_ids: Array(krews[event.status_id]).map(&:last).sort }]
          end
        end
      end

      def self.fixed_reason(_event)
        "an event's audience is set when it's posted"
      end

      def self.follows?
        false
      end

      def self.followable?(audience)
        !audience[:invitees] && super
      end
    end

    # A Booth set is public once published, and has no audience control:
    # it can be Konnected, but never follows and is never followed.
    class Booth < Reach
      def self.read(set)
        { tier: set.published? ? 'public' : 'self_only', krew_ids: [] }
      end

      def self.fixed_reason(_set)
        'a Booth set is always public'
      end

      def self.follows?
        false
      end

      def self.leads?
        false
      end
    end

    ADAPTERS = {
      'albutts' => Album,
      'kalendar' => Event,
      'cinema' => KrewReach,
      'karporn' => KrewReach,
      'kronikles' => KrewReach,
      'art' => KrewReach,
      'wachuneed' => ListingReach,
      'booth' => Booth,
    }.freeze

    module_function

    def supports?(slug)
      ADAPTERS.key?(slug.to_s)
    end

    def adapter(slug)
      ADAPTERS[slug.to_s]
    end

    def slug_of(record)
      record.class.try(:attachment_source_slug)
    end

    def read(record)
      adapter(slug_of(record))&.read(record)
    end

    # `record`'s audience, and whether another record may follow it.
    def leader_audience(record)
      a = adapter(slug_of(record))
      return nil if a.nil?

      audience = a.read(record)
      audience.merge(followable: a.leads? && a.followable?(audience))
    end

    def followable?(record)
      leader_audience(record)&.dig(:followable) || false
    end

    # Audience summaries for many records at once, for lists:
    # `{ [slug, id] => { tier:, krews: [...], hidden_krews:, followable: } }`,
    # Krews named only where `viewer` may see them (Kronk::VisibleKrews).
    # A fixed number of queries per korner, whatever the count.
    def summaries(records, viewer)
      audiences = {}
      records.compact.uniq.group_by { |record| slug_of(record) }.each do |slug, group|
        a = adapter(slug)
        next if a.nil?

        a.read_many(group).each do |id, audience|
          audiences[[slug, id]] = audience.merge(followable: a.leads? && a.followable?(audience))
        end
      end
      named = krews_named(audiences.values.flat_map { |audience| audience[:krew_ids] }, viewer)
      audiences.transform_values { |audience| present(audience, named) }
    end

    def summary(record, viewer)
      summaries([record], viewer)[[slug_of(record), record.id]]
    end

    def krews_named(krew_ids, viewer)
      return {} if krew_ids.empty?

      Kronk::VisibleKrews.filter(Krew.where(id: krew_ids.uniq).to_a, viewer).index_by(&:id)
    end

    def present(audience, named)
      shown = audience[:krew_ids].filter_map { |id| named[id] }
      {
        tier: audience[:tier],
        krews: shown.map { |krew| { id: krew.id.to_s, name: krew.name, slug: krew.slug } },
        hidden_krews: audience[:krew_ids].size - shown.size,
        followable: audience[:followable],
      }
    end

    # Why `follower` can't follow `leader` (a sentence), or nil when it can.
    def follow_error(follower, leader)
      follower_adapter = adapter(slug_of(follower))
      return "#{slug_of(follower)} can't take another record's audience" if follower_adapter.nil?

      reason = follower_adapter.fixed_reason(follower)
      return reason if reason

      leader_adapter = adapter(slug_of(leader))
      return "#{slug_of(leader)} has no audience to follow" if leader_adapter.nil? || !leader_adapter.leads?

      audience = leader_audience(leader)
      return 'only an audience of Everyone or of Krews can be followed; Mates and Orbit belong to their owner' unless audience[:followable]

      if audience[:tier] != 'public' && audience[:krew_ids].any?
        return "#{slug_of(follower)} can't be seen by a Krew, so it can't follow a Krew audience" unless follower_adapter.krews?
        return "you're not in every Krew it's for" unless (audience[:krew_ids] - member_krew_ids(owner_id_of(follower))).empty?
      end
      return 'that would follow itself round in a circle' if leads_back?(leader, follower)

      nil
    end

    # What `follower` is given of a leader's audience (`leader_audience`),
    # never wider than it.
    def fit(audience, follower)
      follower_adapter = adapter(slug_of(follower))
      return { tier: 'self_only', krew_ids: [] } unless audience&.dig(:followable)
      # Everyone sees it either way; the follower keeps its own Krews (and
      # their Konnections).
      return { tier: 'public', krew_ids: nil } if audience[:tier] == 'public'

      krew_ids = follower_adapter.krews? ? audience[:krew_ids] & member_krew_ids(owner_id_of(follower)) : []
      { tier: 'self_only', krew_ids: krew_ids }
    end

    # Give `record` an audience as a follower (its own callbacks then don't
    # read it as its owner's edit), and pass it on to its own followers.
    def write(record, tier:, krew_ids:)
      raise ArgumentError, "unknown tier #{tier}" unless TIERS.include?(tier)

      key = key_of(record)
      writing << key
      begin
        adapter(slug_of(record)).write(record, tier: tier, krew_ids: krew_ids)
      ensure
        writing.delete(key)
      end
      propagate(record)
    end

    # Make `attachment`'s `follower_end` follow the other end, on `actor`'s
    # behalf (the caller checked they may). Drops the follower's other
    # follows and copies the leader's audience.
    def follow!(attachment, follower_end)
      leader_end = (ENDS - [follower_end]).first
      follower = attachment.public_send(:"#{follower_end}_record")
      leader = attachment.public_send(:"#{leader_end}_record")
      KornerAttachment.transaction do
        follows_of(follower).where.not(id: attachment.id).find_each { |other| unfollow!(other) }
        attachment.update!(metadata: (attachment.metadata || {}).merge(FOLLOWS_KEY => leader_end))
        write(follower, **fit(leader_audience(leader), follower))
      end
    end

    def unfollow!(attachment)
      return if attachment.metadata.blank? || !attachment.metadata.key?(FOLLOWS_KEY)

      attachment.update!(metadata: attachment.metadata.except(FOLLOWS_KEY).presence)
    end

    # The end of `attachment` that follows the other, or nil.
    def follower_end(attachment)
      leader_end = attachment.metadata.is_a?(Hash) ? attachment.metadata[FOLLOWS_KEY] : nil
      ENDS.include?(leader_end) ? (ENDS - [leader_end]).first : nil
    end

    # `record`'s audience changed (a model callback, or an event's post or
    # Krews). Unless a follow wrote it, its owner did: that ends its own
    # follow. Either way its followers take the new audience.
    def changed(record)
      return unless supports?(slug_of(record))
      return if writing.include?(key_of(record))

      follows_of(record).find_each { |attachment| unfollow!(attachment) }
      propagate(record)
    end

    # Copy `leader`'s audience to the records following it, and theirs to
    # theirs, synchronously: a record has a handful of Konnections, and the
    # person who changed it should see its followers change with it.
    def propagate(leader)
      state[:depth] += 1
      key = key_of(leader)
      return if state[:depth] > MAX_DEPTH || state[:seen].include?(key)

      state[:seen] << key
      audience = leader_audience(leader)
      followers_of(leader).each do |follower|
        write(follower, **fit(audience, follower))
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.warn("Kronk::Audience: #{key_of(follower).join('/')} could not follow #{key.join('/')}: #{e.message}")
      end
    ensure
      state[:depth] -= 1
      state[:seen].clear if state[:depth].zero?
    end

    # The rows in which `record` follows something.
    def follows_of(record)
      slug = slug_of(record)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      links.where(source_slug: slug, source_id: record.id).where("metadata->>'audience_follows' = 'target'")
           .or(links.where(target_slug: slug, target_id: record.id).where("metadata->>'audience_follows' = 'source'"))
    end

    # The rows in which something follows `record`.
    def followed_by(record)
      slug = slug_of(record)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      links.where(target_slug: slug, target_id: record.id).where("metadata->>'audience_follows' = 'target'")
           .or(links.where(source_slug: slug, source_id: record.id).where("metadata->>'audience_follows' = 'source'"))
    end

    def followers_of(record)
      followed_by(record).to_a.filter_map { |attachment| attachment.public_send(:"#{follower_end(attachment)}_record") }
    end

    # The record `record` follows, or nil.
    def leader_of(record)
      attachment = follows_of(record).first
      return nil if attachment.nil?

      attachment.public_send(:"#{attachment.metadata[FOLLOWS_KEY]}_record")
    end

    # What a record's page says it follows: `{ slug, id, title, url }` of
    # its leader, ids and title left out when `viewer` can't see it; nil
    # when it follows nothing.
    def leader_preview(record, viewer)
      leader = leader_of(record)
      return nil if leader.nil?

      slug = slug_of(leader)
      return { slug: slug, id: nil, title: nil, url: nil, hidden: true } unless Kronk::KornerRecords.visible?(leader, viewer)

      { slug: slug, id: leader.id.to_s, title: Kronk::KornerRecords.title_of(leader), url: Kronk::KornerRecords.path_for(slug, leader) }
    end

    # Whether following `leader` from `follower` would close a circle.
    def leads_back?(leader, follower)
      target = key_of(follower)
      current = leader
      MAX_DEPTH.times do
        return true if key_of(current) == target

        current = leader_of(current)
        return false if current.nil?
      end
      true
    end

    def owner_id_of(record)
      record.respond_to?(:owner_id) ? record.owner_id : record.account_id
    end

    def member_krew_ids(account_id)
      KrewMembership.where(account_id: account_id).pluck(:krew_id)
    end

    def key_of(record)
      [slug_of(record), record.id]
    end

    def writing
      ActiveSupport::IsolatedExecutionState[:"#{STATE}_writing"] ||= Set.new
    end

    def state
      ActiveSupport::IsolatedExecutionState[STATE] ||= { depth: 0, seen: Set.new }
    end
  end
end
