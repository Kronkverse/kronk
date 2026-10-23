# frozen_string_literal: true

# What every korner's primary record has to answer for the things that point
# at it from elsewhere (link previews, korner attachments): who can see it,
# who looks after it, what it's called and where its page is.
#
# A model answers for itself where it can (`visible_to?`, an `owner_id` or
# `account_id`, a `title`), and the few that can't have their rule here,
# matching what their own API allows. Anything unanswered is treated as
# private and unowned, so it fails closed.
module Kronk
  module KornerRecords
    module_function

    # Who can see a record whose model has no `visible_to?`, as its own API
    # decides.
    SEEN_BY = {
      # Published sets, to everyone but people the artist blocked.
      'BoothSet' => ->(set, viewer) { set.account_id == viewer.id || (set.published? && !set.account.blocking?(viewer)) },
      # Every member can read and back every proposal.
      'Proposal' => ->(_proposal, _viewer) { true },
      # A Krew's page opens for anyone with its link.
      'Krew' => ->(krew, viewer) { krew.archived_at.nil? || krew.member?(viewer) },
      # Questions are open to everyone answering them.
      'Question' => ->(_question, _viewer) { true },
      # Main and Rooms are open; a Krew's huddle is its members' (and has no
      # link to its Krew here, so it stays private).
      'HuddleSession' => ->(session, _viewer) { !session.krew? },
      # An item is seen by whoever can see its emergence.
      'Freethedream::Item' => ->(item, viewer) { item.root.visible_to?(viewer) },
    }.freeze

    # Who looks after a record that has neither an `owner_id` nor an
    # `account_id`. They can attach it to things, and take off what others
    # attached to it.
    LOOKED_AFTER_BY = {
      # Whoever proposed it, and whoever has claimed it to build.
      'Proposal' => ->(proposal, account) { account.id.in?([proposal.created_by_account_id, proposal.claimed_by_account_id]) },
      'Question' => ->(question, account) { question.created_by_account_id == account.id },
      # Anyone in the Krew, not only its seeder.
      'Krew' => ->(krew, account) { krew.member?(account) },
      'HuddleSession' => ->(session, account) { session.host_account_id == account.id },
    }.freeze

    # What a search may turn up, where that's narrower than what a link
    # opens: a hidden Krew opens for anyone with its link, but only its
    # members find it.
    FOUND_BY = {
      'Krew' => ->(viewer) { Krew.where(id: Krew.listed.select(:id)).or(Krew.where(id: viewer.krews.select(:id))) },
      'HuddleSession' => ->(_viewer) { HuddleSession.not_retired.where.not(scope: 'krew') },
      'Question' => ->(_viewer) { Question.active },
      # A Place is seen through what's Konnected to it (MapPlace#visible_to?);
      # only ones the viewer made or with a Konnection can pass that check.
      'MapPlace' => ->(viewer) { MapPlace.made_or_konnected(viewer) },
    }.freeze

    # How far back a search looks for records it has to check one by one.
    SEARCH_WINDOW = 200

    TITLE_FIELDS = %i(title name display_name caption prompt).freeze

    def visible?(record, viewer)
      return false if record.nil? || viewer.nil?
      return record.visible_to?(viewer) if record.respond_to?(:visible_to?)

      rule = SEEN_BY[record.class.name]
      rule.present? && rule.call(record, viewer)
    end

    def looked_after_by?(record, account)
      return false if record.nil? || account.nil?

      rule = LOOKED_AFTER_BY[record.class.name]
      return rule.call(record, account) if rule

      owner_id = if record.respond_to?(:owner_id)
                   record.owner_id
                 elsif record.respond_to?(:account_id)
                   record.account_id
                 end
      owner_id.present? && owner_id == account.id
    end

    # Up to `limit` records of `klass` the viewer can see, newest first, out
    # of `scope` (already narrowed by a search). A model with a
    # `visible_to` scope filters in the database; the rest are checked one
    # by one over the newest SEARCH_WINDOW.
    def findable(klass, scope, viewer, limit:)
      found = FOUND_BY[klass.name]
      scope = scope.merge(found.call(viewer)) if found
      scope = scope.order(created_at: :desc)
      return scope.merge(klass.visible_to(viewer)).limit(limit).to_a if klass.respond_to?(:visible_to)

      scope.limit(SEARCH_WINDOW).select { |record| visible?(record, viewer) }.first(limit)
    end

    def title_of(record)
      TITLE_FIELDS.each do |field|
        value = record.try(field)
        return value.strip if value.is_a?(String) && value.strip.present?
      end
      nil
    end

    # The record's page, from the `path:` on its korner's primary resource
    # (`/hub/albutts/albums/:id`, `/hub/krew/:slug`); `/hub/<slug>/<id>`
    # when the manifest doesn't say.
    def path_for(slug, record)
      template = primary_resource(slug)&.dig('path').presence || "/hub/#{slug}/:id"
      template.gsub(/:(id|slug)\b/) { record.public_send(Regexp.last_match(1)).to_s }
    end

    # What `manifest`'s korner is missing to take part in attaching, as
    # sentences for `korners doctor` and the spec: empty when it is wired,
    # or when it opts out with `no_attachments: <why>`. A korner with
    # records takes links unless it says why not (decisions.md, 2026-10-21).
    # A korner with no primary resource has no records and nothing to
    # answer; one whose primary resource names no model is a gap, not a
    # pass, so it can't slip the rule by naming a table that isn't there.
    def attachment_gaps(manifest)
      primary = primary_resource(manifest.slug)
      return [] if primary.nil?

      if manifest.no_attachments.present?
        linked = Array(manifest.attaches).any? || Array(manifest.accepts).any?
        return linked ? ["#{manifest.slug}: says `no_attachments:` but still declares `attaches:` or `accepts:`"] : []
      end

      model = Kronk::KornerRegistry.model_for(manifest.slug)
      return ["#{manifest.slug}: its primary resource `#{primary['name']}` resolves to no model; point it at one, or opt out with `no_attachments: <why>`"] if model.nil?

      gaps = []
      gaps << "#{manifest.slug}: add `accepts: [{ from: '*', kind: link }]`" unless takes_links?(manifest.accepts, 'from')
      gaps << "#{manifest.slug}: add `attaches: [{ to: '*', kind: link, trigger: user, lifecycle: keep }]`" unless takes_links?(manifest.attaches, 'to')
      gaps << "#{manifest.slug}: add `path:` to its primary resource (its record page, e.g. /hub/#{manifest.slug}/:id)" if primary['path'].blank?
      gaps << "#{manifest.slug}: include Kronk::AttachmentSource in #{model.name}, with attachment_source_slug '#{manifest.slug}'" unless model.include?(Kronk::AttachmentSource) && model.attachment_source_slug == manifest.slug
      gaps.map { |gap| "#{gap}, or opt out with `no_attachments: <why>`" }
    end

    def takes_links?(entries, key)
      Array(entries).any? { |entry| entry.is_a?(Hash) && entry['kind'].to_s == 'link' && entry[key].present? }
    end

    def primary_resource(slug)
      Array(Kronk::KornerRegistry.find(slug)&.resources).find { |r| r.is_a?(Hash) && r['primary'] == true }
    end
  end
end
