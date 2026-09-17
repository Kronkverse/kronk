# frozen_string_literal: true

# == Schema Information
#
# Table name: invites
#
#  id         :bigint(8)        not null, primary key
#  user_id    :bigint(8)        not null
#  code       :string           default(""), not null
#  expires_at :datetime
#  max_uses   :integer
#  uses       :integer          default(0), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  autofollow :boolean          default(FALSE), not null
#  comment    :text
#

class Invite < ApplicationRecord
  include Expireable

  COMMENT_SIZE_LIMIT = 420
  ELIGIBLE_CODE_CHARACTERS = [*('a'..'z'), *('A'..'Z'), *('0'..'9')].freeze
  HOMOGLYPHS = %w(0 1 I l O).freeze
  VALID_CODE_CHARACTERS = ELIGIBLE_CODE_CHARACTERS - HOMOGLYPHS

  belongs_to :user, inverse_of: :invites
  has_many :users, inverse_of: :invite, dependent: nil

  scope :available, -> { where(expires_at: nil).or(where(expires_at: Time.now.utc..)) }

  # The single evergreen invite per user — unlimited uses + never
  # expires — surfaced at the top of /invites as "your standard link".
  # Kronk pins this so there's one shareable URL + QR that any
  # signed-in user can hand around without generating a fresh code
  # every time. `uses` and `users.invite_id` still give us the full
  # audit trail per accepted signup.
  scope :evergreen, -> { where(max_uses: nil, expires_at: nil) }

  validates :comment, length: { maximum: COMMENT_SIZE_LIMIT }

  before_validation :set_code, on: :create

  def valid_for_use?
    (max_uses.nil? || uses < max_uses) && !expired? && user&.functional?
  end

  def self.evergreen_for(user)
    user.invites.evergreen.first || user.invites.create!(max_uses: nil)
  end

  private

  def set_code
    loop do
      self.code = VALID_CODE_CHARACTERS.sample(8).join
      break if Invite.find_by(code: code).nil?
    end
  end
end
