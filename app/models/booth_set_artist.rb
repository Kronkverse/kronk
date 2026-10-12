# frozen_string_literal: true

# == Schema Information
#
# Table name: booth_set_artists
#
#  id           :bigint(8)        not null, primary key
#  name         :string
#  position     :integer          default(0), not null
#  verified     :boolean          default(FALSE), not null
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#  account_id   :bigint(8)
#  booth_set_id :bigint(8)        not null
#

# Someone credited on a Booth set alongside its uploader: a tagged Kronk
# account (`verified` once that person confirms it) or a plain name.
class BoothSetArtist < ApplicationRecord
  NAME_MAX = 100

  belongs_to :booth_set, inverse_of: :credits
  belongs_to :account, optional: true

  validates :name, length: { maximum: NAME_MAX }
  validates :name, presence: true, if: -> { account_id.nil? }
  validates :account_id, uniqueness: { scope: :booth_set_id }, allow_nil: true

  def label
    account ? (account.display_name.presence || account.username) : name
  end
end
