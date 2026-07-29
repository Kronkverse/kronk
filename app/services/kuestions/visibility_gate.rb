# frozen_string_literal: true

# Kuestions::VisibilityGate — enforces the "answer-before-view" rule
# AND the per-answer visibility scope, now aligned with the platform-
# wide reach ladder (docs/kronk_feed_and_reach.md §2).
#
# Layer 1 (gate): When Question#locked? is true, a viewer who has not
# posted their own answer sees only their own answer (which may be
# empty). Once they answer, the full answer set becomes _candidate_
# visible.
#
# Layer 2 (per-answer scope): Once the gate opens, each other answer
# is filtered through its own `visibility_scope`, matching the four
# tiers Status/Album/Moment use:
#
# - `public`    — any viewer can see.
# - `orbit`     — mates-of-mates of the answerer (one hop out).
# - `mates`     — mutual connections of the answerer.
# - `self_only` — nobody but the answerer.
#
# The pre-2026-07-29 vocabulary (`everyone / kronk_members /
# connections / vouched / only_me`) was retired in slice 4 of the
# visibility standardisation; the accompanying migration walks
# existing rows onto the new set.
module Kuestions
  module VisibilityGate
    module_function

    def visible_answers(question, viewer)
      return question.answers.none if question.nil?

      gated = gated_answers(question, viewer)
      return gated if viewer.nil? # no-viewer path already applied the strict rule

      gated.select { |a| answer_visible?(a, viewer) }
    end

    def can_view_answers?(question, viewer)
      return false if question.nil?
      return true unless question.locked?
      return true if asker?(question, viewer)

      question.answered_by?(viewer)
    end

    # Answer is visible to `viewer` per its `visibility_scope`. The
    # answerer themselves always sees their own answer regardless of
    # scope.
    def answer_visible?(answer, viewer)
      return false unless answer
      return true  if viewer && viewer.id == answer.account_id

      case answer.visibility_scope
      when 'public'
        true
      when 'orbit'
        return false if viewer.nil?

        viewer.mate?(answer.account) || viewer.orbit_of?(answer.account)
      when 'mates'
        return false if viewer.nil?

        viewer.mate?(answer.account)
      else # self_only or an unknown scope
        false
      end
    end

    def gated_answers(question, viewer)
      if viewer.nil?
        question.locked? ? question.answers.none : question.answers
      elsif question.locked? && !question.answered_by?(viewer) && !asker?(question, viewer)
        question.answers.where(account_id: viewer.id)
      else
        question.answers
      end
    end

    # The asker is exempt from the answer-before-view gate — they own
    # the ask and are the intended audience for the responses (per
    # docs/spaces/kuestions.md §Notifications: "the asker gets a Nudge
    # on every answer"). They can also add their own answer; it counts
    # toward the aggregate.
    def asker?(question, viewer)
      return false if viewer.nil? || question.nil?

      viewer.id == question.created_by_account_id
    end
  end
end
