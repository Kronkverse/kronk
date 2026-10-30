# frozen_string_literal: true

# Tells the people who joined a Komponent when something happens in it
# (docs/spaces/freethedream.md, Joining a Komponent): someone says
# something in its talk, or in a fractal's, or in the talk about a thing
# on its lists; or adds to it (a need, a job, an idea, an offer, a
# fractal), brings something or takes a job on. Not the person who did it,
# and only people still in the projekt. Nudges collapses a burst into one
# (the manifest's aggregation window).
module Freethedream
  module GangNudges
    TALKED = 'freethedream.gang.talked'
    UPDATED = 'freethedream.gang.updated'

    module_function

    # The Komponent a part sits in: itself, or a fractal's parent.
    def gang_of(project)
      return nil if project.nil? || project.top?

      project.gang? ? project : project.parent
    end

    def tell(project, actor_id, event)
      gang = gang_of(project)
      return if gang.nil?

      members = Membership.member.where(project_id: gang.top_id).select(:account_id)
      GangMember.where(project_id: gang.id, account_id: members).where.not(account_id: actor_id).pluck(:account_id).each do |recipient|
        Kronk::KornerEvents.publish(event, actor_account_id: actor_id, recipient_account_id: recipient, project_id: gang.id)
      end
    end

    def comment_made(comment)
      place = comment.subject.is_a?(Project) ? comment.subject : comment.subject.projects.order('freethedream_placements.id').first
      tell(place, comment.account_id, TALKED)
    end

    def activity_logged(activity)
      tell(activity.project, activity.account_id, UPDATED)
    end
  end
end
