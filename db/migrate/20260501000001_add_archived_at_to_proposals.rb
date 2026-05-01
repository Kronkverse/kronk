# frozen_string_literal: true

class AddArchivedAtToProposals < ActiveRecord::Migration[8.0]
  def change
    add_column :proposals, :archived_at, :datetime, null: true
  end
end
