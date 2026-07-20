# frozen_string_literal: true

class AddTitleToProposalVotes < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :proposal_votes, :title, :string, limit: 80
    end
  end
end
