# frozen_string_literal: true

# An Anthemos phone linked to a Kronk account (docs/spaces/map.md, Live
# location). Holds only the public half of the phone's signing key and a
# name to show in Account & Security. Unlinking deletes it, and every live
# share it signed ends with it.
class AnthemosLink < ApplicationRecord
  belongs_to :account
  has_many :live_shares, dependent: nil # ended by #unlink!, then cascaded by the database

  MAX_PER_ACCOUNT = 10

  validates :device_name, presence: true, length: { maximum: 60 }
  validates :public_key, presence: true
  validate :readable_key
  validate :room_for_another, on: :create

  def verify?(signature, *parts)
    Kronk::AnthemosSignature.valid?(public_key, signature, *parts)
  end

  def unlink!
    live_shares.each(&:stop!)
    destroy!
  end

  private

  def readable_key
    Kronk::AnthemosSignature.public_key(public_key) if public_key.present?
  rescue ArgumentError
    errors.add(:public_key, :invalid)
  end

  def room_for_another
    errors.add(:base, :too_many) if AnthemosLink.where(account_id: account_id).count >= MAX_PER_ACCOUNT
  end
end
