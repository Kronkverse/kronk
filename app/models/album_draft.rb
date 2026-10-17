# frozen_string_literal: true

# == Schema Information
#
# Table name: album_drafts
#
#  id                   :bigint(8)        not null, primary key
#  account_id           :bigint(8)        not null
#  params               :jsonb            not null
#  media_attachment_ids :bigint           default([]), not null, is an Array
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#

# An album being put together (docs/spaces/albutts.md, Drafts): the
# composer's fields in `params`, and the photos it has already uploaded, in
# order, by id. Captions sit in `params['captions']`, keyed by media id. An
# account keeps up to MAX_PER_ACCOUNT, so one album can wait while another
# is started. The uploads stay unattached until the album is created, and
# the nightly cleanup leaves alone any upload a draft lists.
class AlbumDraft < ApplicationRecord
  MAX_PER_ACCOUNT = 20
  MAX_PHOTOS = 1000
  MAX_PARAMS_BYTES = 256.kilobytes

  belongs_to :account, inverse_of: :album_drafts

  validates :media_attachment_ids, length: { maximum: MAX_PHOTOS }
  validate :params_size
  validate :drafts_per_account, on: :create

  scope :recent, -> { order(updated_at: :desc) }

  def media_attachments
    return [] if media_attachment_ids.blank?

    by_id = account.media_attachments.where(id: media_attachment_ids).index_by(&:id)
    media_attachment_ids.filter_map { |id| by_id[id] }
  end

  private

  def params_size
    errors.add(:params, 'is too large') if params.to_json.bytesize > MAX_PARAMS_BYTES
  end

  def drafts_per_account
    errors.add(:base, "You can keep up to #{MAX_PER_ACCOUNT} album drafts") if account && account.album_drafts.count >= MAX_PER_ACCOUNT
  end
end
