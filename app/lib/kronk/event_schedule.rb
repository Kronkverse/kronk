# frozen_string_literal: true

# Who edits an event's schedule (docs/spaces/kalendar.md, Schedule; Tal,
# 2026-11-18). An event has one schedule. On its own, its host edits it.
# Konnected to a projekt (or one of its Komponents), anyone in the projekt
# does, from the projekt's page or the event's, and the event shows the
# same lines: the projekt is where the work is planned, so the people
# doing it keep the schedule (err syntropic, decisions.md 2026-10-19).
#
# The projekt counts the way its Events section does
# (Freethedream::Project#event_links): a link either way, and only when
# the event's host is in the projekt, so linking your event to someone
# else's projekt doesn't hand its schedule to strangers.
module Kronk
  module EventSchedule
    module_function

    # The projekt (top level) whose members keep the event's schedule, or nil.
    def projekt_for(event)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      links = links.where(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream')
                   .or(links.where(source_slug: 'freethedream', target_slug: 'kalendar', target_id: event.id))
                   .order(created_at: :desc)

      links.each do |link|
        _, _, id = AttachmentEffects.ends(link, 'kalendar')
        top = Freethedream::Project.find_by(id: id)&.top
        return top if top&.member?(event.account)
      end
      nil
    end

    def can_edit?(event, account, projekt: projekt_for(event))
      return false if account.nil?
      return true if event.account_id == account.id

      projekt.present? && projekt.member?(account)
    end
  end
end
