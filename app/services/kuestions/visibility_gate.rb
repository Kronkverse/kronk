# frozen_string_literal: true

# Kuestions::VisibilityGate — enforces the "answer-before-view" rule.
#
# The rule (maintainer, 2026-07-31): anyone who can see a question can
# see all of its answers. The gate is the ONLY access control on the
# answer list — there is no per-answer hiding from a viewer who has
# passed it.
#
# - Unlocked question: the answers are open — visible to anyone,
#   including anonymous viewers.
# - Locked question: a viewer who has not posted their own answer sees
#   only their own (which may be empty); the asker is exempt. Once the
#   viewer answers, the full answer set becomes visible.
#
# (An answer's own `visibility_scope` still governs how it projects as a
# Status into feeds elsewhere; it does not gate the in-question list.)
#
# Profile Kuestions are the exception: they are never locked, and each
# answer is listed only where its author's profile would show it.
module Kuestions
  module VisibilityGate
    module_function

    def visible_answers(question, viewer)
      return Answer.none if question.nil?
      return profile_answers(question, viewer) if question.profile?

      # Anyone who can see the question can see its answers: the gate is the
      # only access control on the list. gated_answers already returns the
      # correct set for every case (open, locked-unanswered, locked-answered,
      # asker, anonymous).
      gated_answers(question, viewer)
    end

    def can_view_answers?(question, viewer)
      return false if question.nil?
      return true unless question.locked?
      return true if asker?(question, viewer)

      question.answered_by?(viewer)
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

    # A profile Kuestion has no gate: each answer shows where its author's
    # profile would show it (Answer#visible_on_profile_to?).
    def profile_answers(question, viewer)
      question.answers.includes(:account).select { |answer| answer.visible_on_profile_to?(viewer) }
    end

    # The asker is exempt from the answer-before-view gate — they own
    # the ask and are the intended audience for the responses (per
    # docs/spaces/kuestions.md § The answer gate). They can also add
    # their own answer; it counts toward the aggregate.
    def asker?(question, viewer)
      return false if viewer.nil? || question.nil?

      viewer.id == question.created_by_account_id
    end
  end
end
