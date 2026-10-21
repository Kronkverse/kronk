# frozen_string_literal: true

# Guards on KornerAttachment.
#
# create   — the user must own the source record (they're wiring their own
#            thing to a target; the target's `accepts:` already opts in).
# destroy  — the row's creator, source-owner, or target-owner. Either end
#            of the join can undo it.
# show     — the user must be able to see BOTH endpoint records. Filter at
#            query time so a private target attached to a public source
#            doesn't leak.
#
# Who looks after a record and who can see it come from Kronk::KornerRecords,
# the same rules link previews use: a model's own `visible_to?`, `owner_id`
# or `account_id`, or the rule written there for the few models without
# them. Unanswered falls closed (private, unowned).
# Spec: docs/korners/adding_a_korner.md (Korner attachments) §3.1, §6.
class KornerAttachmentPolicy < ApplicationPolicy
  def show?
    return false unless current_account

    source = record.source_record
    target = record.target_record
    visible?(source) && visible?(target)
  end

  def create?
    return false unless current_account

    own?(record.source_record)
  end

  def destroy?
    return false unless current_account

    record.created_by_account_id == current_account.id ||
      own?(record.source_record) ||
      own?(record.target_record)
  end

  private

  def own?(rec)
    Kronk::KornerRecords.looked_after_by?(rec, current_account)
  end

  def visible?(rec)
    Kronk::KornerRecords.visible?(rec, current_account)
  end
end
