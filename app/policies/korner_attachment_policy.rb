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
# Owner resolution walks a small ladder rather than requiring every record
# type to expose the same method: `owner` (Album), `account` (Event, BoothSet,
# Moment, Nudge). Falls closed on records with neither.
#
# Visibility uses `visible_to?(account)` when the record exposes it and falls
# closed otherwise — records without an explicit visibility method (e.g. a
# Kronk primitive still being defined) are treated as private-by-default.
# Spec: docs/kronk_korner_attachments.md §3.1, §6.
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
    return false unless rec
    return false unless current_account

    owner_id = if rec.respond_to?(:owner_id) && rec.respond_to?(:owner)
                 rec.owner_id
               elsif rec.respond_to?(:account_id)
                 rec.account_id
               end
    owner_id == current_account.id
  end

  def visible?(rec)
    return false unless rec

    if rec.respond_to?(:visible_to?)
      rec.visible_to?(current_account)
    else
      own?(rec)
    end
  end
end
