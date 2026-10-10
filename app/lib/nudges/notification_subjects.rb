# frozen_string_literal: true

# Nudges::NotificationSubjects — what each notification is about, and where
# a tap on it goes. An event stores only a reference to its source
# (`source_type` + `source_id`, docs/spaces/nudges.md (Nudges spec)
# § Concept); this resolves a page of them in one query per type, so a row
# can read "Ana backed your proposal: Community garden".
#
# A source that has been deleted, or a post the viewer may not see, resolves
# to no title. The row still shows; it just says less.
module Nudges
  class NotificationSubjects
    TITLE_LENGTH = 80

    # Sources that carry a plain `title`, and the page each one opens.
    TITLED = {
      'Proposal' => '/hub/kommons/p/%<id>s',
      'Event' => '/hub/kalendar/%<id>s',
      'Listing' => '/hub/wachuneed/listings/%<id>s',
      'Question' => '/hub/kuestions/%<id>s',
      'BoothSet' => '/hub/booth/sets/%<id>s',
      'Album' => '/hub/albutts/albums/%<id>s',
    }.freeze

    def initialize(events, viewer:)
      @viewer = viewer
      @titles = resolve(events)
    end

    def title_for(event)
      @titles[[event.source_type, event.source_id]]
    end

    # The event's own link if it has one. Otherwise the thing it is about,
    # when that still exists; otherwise the person who did it.
    def route_for(event)
      return event.cta_route if event.cta_route.present?

      if known?(event)
        return "/statuses/#{event.source_id}" if event.source_type == 'Status'

        template = TITLED[event.source_type]
        return format(template, id: event.source_id) if template
      end

      "/@#{event.actor_account.acct}"
    end

    private

    # Found, and the viewer may see it. Separate from having a title: a post
    # that is only a photo exists and has nothing to quote.
    def known?(event)
      @titles.key?([event.source_type, event.source_id])
    end

    def resolve(events)
      refs = events.select { |event| event.source_type.present? && event.source_id.present? }

      refs.group_by(&:source_type).each_with_object({}) do |(type, members), titles|
        ids = members.map(&:source_id).uniq

        found = type == 'Status' ? status_titles(ids) : record_titles(type, ids)
        found.each { |id, title| titles[[type, id]] = title }
      end
    end

    def record_titles(type, ids)
      return {} unless TITLED.key?(type)

      type.constantize.where(id: ids).pluck(:id, :title).to_h.transform_values { |title| clip(title) }
    end

    # A post's first words, but only for a post the viewer is allowed to
    # see: a reply or mention can come from someone whose post is not
    # addressed to them.
    def status_titles(ids)
      Status.where(id: ids).includes(:account).filter_map do |status|
        next unless StatusPolicy.new(@viewer, status).show?

        text = status.spoiler_text.presence || PlainTextFormatter.new(status.text, status.local?).to_s
        [status.id, clip(text)]
      end.to_h
    end

    def clip(text)
      text.to_s.squish.truncate(TITLE_LENGTH, omission: '…').presence
    end
  end
end
