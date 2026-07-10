# frozen_string_literal: true

# Kuestions::VisibilityGate — enforces the "answer-before-view" rule.
#
# When Question#locked? is true, a viewer who has not posted their own
# answer sees only their own answer (which may be empty). Once they
# answer, the full set of answers becomes visible.
#
# When Question#locked? is false, all answers are visible to any viewer
# with baseline permission — the model behaves like a regular threaded
# discussion.
#
# See docs/kronk_korner_spec.md §Kuestions and delta rollup I1.
module Kuestions
  module VisibilityGate
    module_function

    def visible_answers(question, viewer)
      return question.answers.none if question.nil?

      if viewer.nil?
        question.locked? ? question.answers.none : question.answers
      elsif question.locked? && !question.answered_by?(viewer)
        question.answers.where(account_id: viewer.id)
      else
        question.answers
      end
    end

    def can_view_answers?(question, viewer)
      return false if question.nil?
      return true unless question.locked?

      question.answered_by?(viewer)
    end
  end
end
