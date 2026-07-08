# frozen_string_literal: true

# == Schema Information
#
# Table name: klot_shares
#
#  id                :bigint(8)        not null, primary key
#  account_id        :bigint(8)        not null
#  viewer_account_id :bigint(8)        not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#

# Access control for Klot phase visibility.
#
# The owner (`account`) has explicitly allowed `viewer_account` to see
# THIS ACCOUNT's current cycle phase — and nothing else. Viewers never
# see the underlying log of period dates, day numbers, or notes. The
# projection they receive is the phase-only shape served by
# `Api::V1::Klot::PhasesController`.
class KlotShare < ApplicationRecord
  belongs_to :account
  belongs_to :viewer_account, class_name: 'Account'

  validates :viewer_account_id,
            uniqueness: { scope: :account_id },
            comparison: { other_than: :account_id, message: 'cannot share with yourself' }
end
