# frozen_string_literal: true

# Who sees and removes a call recording (Tal, 2026-10-27): a Kuddle's,
# whoever can see the Kuddle; the Main Huddle's, every signed-in member; a
# live set's, its host (it's theirs to publish as a set). Removing is for
# whoever moderates the call: the Kuddle's maker, the set's host, staff.
# The rule itself is the call's (Kronk::CallTarget).
class CallRecordingPolicy < ApplicationPolicy
  def show?
    record.ready? && target.present? && target.recordings_visible_to?(current_account)
  end

  def destroy?
    target.present? && target.recordings_manageable_by?(current_account)
  end

  private

  def target
    @target ||= record.target
  end
end
