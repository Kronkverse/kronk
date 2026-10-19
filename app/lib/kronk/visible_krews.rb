# frozen_string_literal: true

# Which of a post's (or an album's, or an event's) Krews a viewer may see
# named. A listed Krew is findable in Discover anyway; an invite-only one is
# named only to its members, so linking something public to a hidden Krew
# doesn't give away its name, address or, from that, its member list.
module Kronk::VisibleKrews
  module_function

  def filter(krews, viewer)
    hidden = krews.reject(&:listed?)
    return krews if hidden.empty?

    member_ids = viewer ? KrewMembership.where(account_id: viewer.id, krew_id: hidden.map(&:id)).pluck(:krew_id) : []
    krews.select { |krew| krew.listed? || member_ids.include?(krew.id) }
  end
end
