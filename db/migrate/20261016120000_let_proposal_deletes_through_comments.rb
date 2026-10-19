# frozen_string_literal: true

# A proposal's other children (tasks, votes, backings, joins, attachments)
# go with it, but its comments had no ON DELETE rule. Deleting a proposer's
# account cascades to their proposals, so a proposal anyone else had
# commented on made the whole account deletion fail. Comments now go with
# their proposal like the rest.
class LetProposalDeletesThroughComments < ActiveRecord::Migration[8.0]
  def up
    safety_assured { execute "SET LOCAL lock_timeout = '5s'" }

    remove_foreign_key :proposal_comments, :proposals
    add_foreign_key :proposal_comments, :proposals, on_delete: :cascade, validate: false
  end

  def down
    safety_assured { execute "SET LOCAL lock_timeout = '5s'" }

    remove_foreign_key :proposal_comments, :proposals
    add_foreign_key :proposal_comments, :proposals
  end
end
