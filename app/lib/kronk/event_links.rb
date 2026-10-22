# frozen_string_literal: true

# An emergence and its Krew are one group of people, so an event linked to
# either is linked to both (Tal 2026-10-22: "I want to edit an event to
# attach it into an emergence, and that within a krew").
#
# The link is a korner attachment, made from either end (event → Krew or
# Krew → event read the same); a Krew reads its events from their posts'
# audience (Api::V1::EventsController#for_krew). Every way of linking (the
# Attach picker from the event, the Krew or the emergence, the Krew's "Link
# one of your events", the Krews picked in the event composer) comes here
# through Kronk::AttachmentEffects, which keeps the two in step; unlinking
# from any of them takes the event off both.
#
# The Krew only becomes an audience when the event's maker links it and is
# in the Krew, as the Krew's own Link button requires; it then gets the
# Kalendar space, where the Krew page lists events. An invite-only event
# stays for its invitees. A link someone else makes stays a link.
module Kronk
  module EventLinks
    module_function

    GROUP_SLUGS = %w(krew freethedream).freeze

    # The Krew an event linked to this record reaches: the Krew itself, or
    # the Krew of an emergence (a gang shares its emergence's Krew).
    def krew_for(slug, id)
      case slug
      when 'krew' then Krew.find_by(id: id)
      when 'freethedream' then Freethedream::Project.find_by(id: id)&.top&.krew
      end
    end

    # After `attachment` was saved by `actor`.
    def linked(attachment, actor)
      event, krew, slug = resolve(attachment)
      return if event.nil? || krew.nil?

      share(event, krew, actor)
      link_emergence(event, krew, actor) if slug == 'krew'
    end

    # After `attachment` was removed. Unlinking from either end takes the
    # event off both (2026-10-22): its other links to the Krew, its
    # emergence and gangs go too, and the Krew stops being an audience.
    def unlinked(attachment)
      event, krew, = resolve(attachment)
      return if event.nil? || krew.nil?

      unlink!(event, krew)
    end

    # The Krew page's Link button.
    def link!(event, krew, actor)
      AttachmentEffects.link!('kalendar', event.id, 'krew', krew.id, actor)
    end

    # The Krew page's Unlink button: off the Krew and its emergence.
    def unlink!(event, krew)
      StatusKrews.remove(event.status_id, krew.id)
      group_links(event, krew).delete_all
    end

    # The event's post was just made, or made again (turning invite-only
    # off posts it afresh): the Krews picked in the composer are linked,
    # and the Krews it was linked to before are its audience again.
    def posted(event, actor)
      return if event.status.nil?

      event.status.krews.each { |krew| link!(event, krew, actor) }
      linked_krews(event).each { |krew| share(event, krew, actor) }
    end

    # [event, Krew it reaches, the other end's slug], or nils.
    def resolve(attachment)
      return [nil, nil, nil] unless event_link?(attachment)

      event_id, slug, id = AttachmentEffects.ends(attachment, 'kalendar')
      [Event.find_by(id: event_id), krew_for(slug, id), slug]
    end

    def event_link?(attachment)
      return false unless attachment.kind == KornerAttachment::KIND_LINK

      pair = [attachment.source_slug, attachment.target_slug]
      pair.include?('kalendar') && GROUP_SLUGS.intersect?(pair)
    end

    def share(event, krew, actor)
      return if event.status_id.nil? || event.invite_only?
      return unless event.account_id == actor.id && krew.member?(actor) && !krew.archived?

      StatusKrews.add(event.status_id, krew.id)
      # The Krew page lists events under its Kalendar space, and an
      # emergence's Krew starts with none, so the event would be linked but
      # out of sight.
      krew.krew_korners.find_or_create_by!(korner: 'kalendar')
    end

    def link_emergence(event, krew, actor)
      project = krew.freethedream_project
      return if project.nil? || AttachmentEffects.between('kalendar', event.id, 'freethedream', project.id).exists?

      KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: project.id,
                               kind: KornerAttachment::KIND_LINK, created_by_account: actor)
    end

    # Every Krew the event is linked to, directly or through an emergence.
    def linked_krews(event)
      links_of(event).filter_map do |attachment|
        _, slug, id = AttachmentEffects.ends(attachment, 'kalendar')
        krew_for(slug, id) if GROUP_SLUGS.include?(slug)
      end.uniq
    end

    # Every link from or to `event`.
    def links_of(event)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      links.where(source_slug: 'kalendar', source_id: event.id).or(links.where(target_slug: 'kalendar', target_id: event.id))
    end

    # Every link between `event` and the Krew or its emergence and gangs,
    # made from either end.
    def group_links(event, krew)
      project = krew.freethedream_project
      project_ids = project ? Freethedream::Project.where(id: project.id).or(Freethedream::Project.where(root_id: project.id)).pluck(:id) : []
      links = links_of(event)
      to_group = ->(slug, ids) { links.where(source_slug: slug, source_id: ids).or(links.where(target_slug: slug, target_id: ids)) }
      to_group.call('krew', krew.id).or(to_group.call('freethedream', project_ids))
    end
  end
end
