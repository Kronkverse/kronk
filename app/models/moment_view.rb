# frozen_string_literal: true

# == Schema Information
#
# Table name: moment_views
#
#  id         :bigint(8)        not null, primary key
#  moment_id  :bigint(8)        not null
#  account_id :bigint(8)        not null
#  created_at :datetime         not null
#

# Someone saw a Moment (docs/spaces/moments.md, Views). The owner's own
# looks don't count. Recorded once per viewer; `Moment#views_count` keeps
# the total.
class MomentView < ApplicationRecord
  belongs_to :moment, inverse_of: :moment_views
  belongs_to :account

  def self.record!(moment, account)
    return if account.nil? || moment.account_id == account.id

    inserted = insert_all(
      [{ moment_id: moment.id, account_id: account.id, created_at: Time.current }],
      unique_by: :index_moment_views_on_moment_id_and_account_id,
      returning: [:id]
    )
    Moment.update_counters(moment.id, views_count: 1) if inserted.rows.any?
  end
end
