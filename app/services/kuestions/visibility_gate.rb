# frozen_string_literal: true

# Kuestions::VisibilityGate — enforces the "answer-before-view" rule
# AND the per-answer visibility scope introduced by Phase 1b.
#
# Layer 1 (gate): When Question#locked? is true, a viewer who has not
# posted their own answer sees only their own answer (which may be
# empty). Once they answer, the full answer set becomes _candidate_
# visible.
#
# Layer 2 (per-answer scope): Once the gate opens, each other answer
# is filtered through its own `visibility_scope`:
#
# - `everyone` — any viewer (including anonymous) can see.
# - `kronk_members` — any locally-signed-in account can see.
# - `connections` — Mates (mutual follow) of the answerer can see.
# - `vouched` — awaits the vouching model; currently equivalent to
#   `connections` so answers posted under this scope stay private.
# - `only_me` — nobody but the answerer.
#
# See docs/kronk_korner_spec.md §Kuestions and delta rollup I1.
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

      question.answered_by?(viewer)
    end

    # Answer is visible to `viewer` per its `visibility_scope`. The
    # answerer themselves always sees their own answer regardless of
    # scope.
    def answer_visible?(answer, viewer)
      return false unless answer
      return true  if viewer && viewer.id == answer.account_id

      case answer.visibility_scope
      when 'everyone'
        true
      when 'kronk_members'
        viewer.present? && viewer.local?
      when 'connections', 'vouched'
        viewer.present? && mates?(answer.account, viewer)
      else # only_me and any unknown scope
        false
      end
    end

    def gated_answers(question, viewer)
      if viewer.nil?
        question.locked? ? question.answers.none : question.answers
      elsif question.locked? && !question.answered_by?(viewer)
        question.answers.where(account_id: viewer.id)
      else
        question.answers
      end
    end

    # Mates = mutual follow, matching Nudges::EventRouter's Mate
    # gate. Kept local so this file stays self-contained.
    def mates?(one, two)
      return false unless one && two

      Follow.exists?(account: one, target_account: two) &&
        Follow.exists?(account: two, target_account: one)
    end
  end
end
