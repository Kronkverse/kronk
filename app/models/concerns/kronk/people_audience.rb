# frozen_string_literal: true

# Kronk::PeopleAudience — the people a korner record is for, or kept from,
# on top of its reach tier and Krews: the record's own version of a post's
# per-post audience (docs/spaces/feed.md, Per-post audience;
# decisions.md 2026-11-19). Films, kars, kronikles, art pieces and
# listings take it, the same five as Kronk::KrewAudience, in one table:
# `record_people` (korner slug + record id + account).
#
# People are added (they see the record whatever its tier) or kept out
# (they don't, whatever else would let them; an exclusion beats every
# grant). Only a gated tier carries them: a Kronkverse record can't be
# narrowed person by person, so it has none. Its feed post carries the
# same people (`status_audience_grants` / `status_audience_exclusions`),
# so the card and the record agree on who sees them.
#
# Reachable asks `reachable_chosen?` / `reachable_kept_out?` and their
# scopes; this concern answers them, so including it is the whole wiring.
module Kronk
  module PeopleAudience
    extend ActiveSupport::Concern

    GATED_TIERS = %w(mates orbit self_only).freeze

    included do
      model = self
      has_many :record_people, -> { where(korner_slug: model.attachment_source_slug) },
               foreign_key: :record_id, dependent: :delete_all, inverse_of: false
    end

    class_methods do
      # Records `viewer` was added to by name.
      def reachable_chosen_scope(viewer)
        where(id: RecordPerson.added.where(korner_slug: attachment_source_slug, account_id: viewer.id).select(:record_id))
      end

      # Gated records `viewer` was kept out of by name (a Kronkverse one
      # keeps no one out, even if its people outlived a change of tier).
      def reachable_kept_out_scope(viewer)
        where(visibility: GATED_TIERS)
          .where(id: RecordPerson.removed.where(korner_slug: attachment_source_slug, account_id: viewer.id).select(:record_id))
          .select(:id)
      end
    end

    def audience_added_ids
      record_people.reject(&:excluded).map(&:account_id)
    end

    def audience_removed_ids
      record_people.select(&:excluded).map(&:account_id)
    end

    # Make the record's people exactly `added` and `removed` (account ids),
    # and its feed post's with them. Local accounts only, never the owner;
    # someone in both lists is kept out. None at all on a Kronkverse record.
    def sync_audience_people!(added:, removed:)
      removed = audience_people_ids(removed)
      added   = audience_people_ids(added) - removed
      added = removed = [] unless GATED_TIERS.include?(visibility.to_s)

      wanted = added.index_with(false).merge(removed.index_with(true))
      before = record_people.pluck(:account_id, :excluded).to_h
      return if wanted == before

      record_people.where.not(account_id: wanted.keys).delete_all
      wanted.each do |account_id, excluded|
        next if before[account_id] == excluded

        record_people.where(account_id: account_id).delete_all
        record_people.create!(account_id: account_id, excluded: excluded)
      end
      record_people.reset

      sync_status_people!(added: added, removed: removed, before: before)
    end

    private

    def reachable_chosen?(viewer)
      viewer.present? && record_people.added.exists?(account_id: viewer.id)
    end

    def reachable_kept_out?(viewer)
      viewer.present? && GATED_TIERS.include?(visibility.to_s) && record_people.removed.exists?(account_id: viewer.id)
    end

    def audience_people_ids(ids)
      ids = Array(ids).map(&:to_i).reject(&:zero?).uniq - [reachable_owner_id]
      Account.local.without_suspended.where(id: ids).pluck(:id)
    end

    # The feed post takes the same people. Someone newly added gets the card
    # in their home feed; someone taken off or kept out loses it, unless
    # they can still see it another way (as Albutts::Viewers does).
    def sync_status_people!(added:, removed:, before:)
      status = Status.find_by(id: status_id)
      return if status.nil?

      status.granted_accounts  = Account.where(id: added)
      status.excluded_accounts = Account.where(id: removed)

      newly_added = added - before.reject { |_, excluded| excluded }.keys
      lost = (before.keys - added) | removed

      Account.where(id: newly_added).includes(:user).find_each do |account|
        FeedManager.instance.push_to_home(account, status) if StatusPolicy.new(account, status).show?
      end
      Account.where(id: lost).includes(:user).find_each do |account|
        FeedManager.instance.unpush_from_home(account, status) unless StatusPolicy.new(account, status).show?
      end
    end
  end
end
