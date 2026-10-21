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
      'Question' => '/hub/kuestions/answered?k=%<id>s',
      'BoothSet' => '/hub/booth/sets/%<id>s',
      'Album' => '/hub/albutts/albums/%<id>s',
      'Freethedream::Project' => '/hub/freethedream/p/%<id>s',
      'Freethedream::Item' => '/hub/freethedream/i/%<id>s',
    }.freeze

    def initialize(events, viewer:)
      @viewer = viewer
      @pages  = {}
      @titles = resolve(events)
    end

    def title_for(event)
      @titles[[event.source_type, event.source_id]]
    end

    # The event's own link if it has one. Otherwise the thing it is about,
    # when that still exists; otherwise the person who did it, if anyone.
    #
    # A post that only backs something a space owns (Status#kronk_page)
    # opens that instead: the post page would be empty (Tal 2026-10-15, a
    # froth on a Moment).
    def route_for(event)
      page = @pages[event.source_id] if event.source_type == 'Status'
      return page if page

      return event.cta_route if event.cta_route.present?

      if known?(event)
        return "/statuses/#{event.source_id}" if event.source_type == 'Status'

        template = TITLED[event.source_type]
        return format(template, id: event.source_id) if template
      end

      event.actor_account ? "/@#{event.actor_account.acct}" : '/nudges'
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

        found = case type
                when 'Status' then status_titles(ids)
                when 'HuddleSession' then huddle_titles(ids)
                else record_titles(type, ids)
                end
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
      Status.where(id: ids).includes(:account, :moment, :album_photo, :answer).filter_map do |status|
        next unless StatusPolicy.new(@viewer, status).show?

        @pages[status.id] = status.kronk_page
        text = status.spoiler_text.presence || status.moment&.caption.presence ||
               PlainTextFormatter.new(status.text, status.local?).to_s
        [status.id, clip(text)]
      end.to_h
    end

    # How many are in the Huddle now, not when the nudge was made: it is a
    # moment, and a number from an hour ago would mislead. Nothing once it
    # has emptied or the count is unknown.
    def huddle_titles(ids)
      count = Kronk::HuddleCount.last_seen
      return {} unless count&.positive?

      ids.index_with { I18n.t('nudges.subjects.huddle_now', count: count) }
    end

    def clip(text)
      text.to_s.squish.truncate(TITLE_LENGTH, omission: '…').presence
    end
  end
end
