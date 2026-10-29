# frozen_string_literal: true

# Who sees a call recording (Tal, 2026-10-27): a Kuddle's, whoever can see
# the Kuddle; the Main Huddle's, every signed-in member; a live set's, its
# host (it's theirs to publish as a set). The rule itself is the call's
# (Kronk::CallTarget). Nobody deletes one: once recorded, it is kept (Tal,
# 2026-10-29).
class CallRecordingPolicy < ApplicationPolicy
  def show?
    record.ready? && target.present? && target.recordings_visible_to?(current_account)
  end

  private

  def target
    @target ||= record.target
  end
end
