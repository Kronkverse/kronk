# frozen_string_literal: true

# An emergence and its Krew are one group of people, so an event linked to
# either is linked to both (Tal 2026-10-22: "I want to edit an event to
# attach it into an emergence, and that within a krew").
#
# The two halves were stored apart: an emergence reads a korner attachment
# from the event (Freethedream::Project#event_link), and a Krew reads its
# events from their posts' audience (Api::V1::EventsController#for_krew).
# Every way of linking (the event's Attach, the emergence's "link one of
# your events", the Krew's "Link one of your events") ends up here, which
# writes both; unlinking from any of them takes the event off both.
#
# The Krew only becomes an audience when the event's maker links it and is
# in the Krew, as the Krew's own Link button requires; it then gets the
# Kalendar space, where the Krew page lists events. An invite-only event
# stays for its invitees.
module Kronk
  module EventLinks
    module_function

    # The Krew an event linked to this record reaches: the Krew itself, or
    # the Krew of an emergence (a gang shares its emergence's Krew).
    def krew_for(target_slug, target_id)
      case target_slug
      when 'krew' then Krew.find_by(id: target_id)
      when 'freethedream' then Freethedream::Project.find_by(id: target_id)&.top&.krew
      end
    end

    # After `attachment` was saved by `actor`.
    def linked(attachment, actor)
      return unless event_link?(attachment)

      event = Event.find_by(id: attachment.source_id)
      krew = krew_for(attachment.target_slug, attachment.target_id)
      return if event.nil? || krew.nil?

      share(event, krew, actor)
      link_emergence(event, krew, actor) if attachment.target_slug == 'krew'
    end

    # After `attachment` was removed. The Krew stops being an audience once
    # nothing links the event to the group any more.
    def unlinked(attachment)
      return unless event_link?(attachment)

      event = Event.find_by(id: attachment.source_id)
      krew = krew_for(attachment.target_slug, attachment.target_id)
      return if event.nil? || krew.nil?

      StatusKrews.remove(event.status_id, krew.id) unless group_links(event, krew).exists?
    end

    # The Krew's own Link button: the post's audience is set by the caller.
    def linked_from_krew(event, krew, actor)
      link_emergence(event, krew, actor)
    end

    # The Krew's own Unlink button: off the Krew and its emergence.
    def unlinked_from_krew(event, krew)
      StatusKrews.remove(event.status_id, krew.id)
      group_links(event, krew).delete_all
    end

    def event_link?(attachment)
      attachment.source_slug == 'kalendar' && attachment.kind == KornerAttachment::KIND_LINK && %w(krew freethedream).include?(attachment.target_slug)
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
      return if project.nil?

      KornerAttachment.find_or_create_by!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: project.id, kind: KornerAttachment::KIND_LINK) do |a|
        a.created_by_account = actor
      end
    end

    # Every link from `event` to the Krew or to its emergence and gangs.
    def group_links(event, krew)
      links = KornerAttachment.from_source('kalendar', event.id).where(kind: KornerAttachment::KIND_LINK)
      project = krew.freethedream_project
      projects = project ? Freethedream::Project.where(id: project.id).or(Freethedream::Project.where(root_id: project.id)).select(:id) : []
      links.where(target_slug: 'krew', target_id: krew.id).or(links.where(target_slug: 'freethedream', target_id: projects))
    end
  end
end
