# frozen_string_literal: true

# Asking to join a by-request emergence is now a request to its Krew: one
# list, whichever page someone asked from, that anyone in can answer (Tal,
# 2026-10-19). Requests made on the emergence page before then move to the
# Krew's list, keeping when they were made. Safe to re-run.
class MoveFreethedreamRequestsToKrews < ActiveRecord::Migration[8.0]
  def up
    Freethedream::Membership.requested.includes(:project, :account).find_each do |membership|
      krew = membership.project.ensure_krew!
      if krew && !krew.krew_memberships.exists?(account_id: membership.account_id)
        krew.krew_join_requests.find_or_create_by!(account_id: membership.account_id) do |request|
          request.created_at = membership.created_at
        end
      end
      membership.delete
    end
  end

  def down
    # The requests live on in the Krew; nothing to put back.
  end
end
