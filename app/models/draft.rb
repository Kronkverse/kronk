# frozen_string_literal: true

# == Schema Information
#
# Table name: drafts
#
#  id                   :bigint(8)        not null, primary key
#  account_id           :bigint(8)        not null
#  korner               :string           default("feed"), not null
#  kind                 :string           default("post"), not null
#  context              :string
#  version              :integer          default(1), not null
#  params               :jsonb            not null
#  media_attachment_ids :bigint           default([]), not null, is an Array
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#
# Something being written in a composer, saved as it is written so closing
# the composer, a refresh or another device never loses it (docs/design.md,
# Drafts; docs/decisions.md, 2026-10-19). One table for every composer:
#
#   korner   the space whose composer it is (a manifest slug: feed, kalendar…)
#   kind     which composer in that space (post, event, album, contribute…)
#   context  optional, what it hangs off: "reply:<status id>",
#            "krew:<id>", "profile:<account id>". Drafts with a context are
#            only offered back in that place.
#   version  the shape of `params`, so a composer can read an older draft
#   params   the composer's fields, as the composer chose to save them
#
# Uploads are referenced by id, in order, and only the account's own
# resolve. They stay unattached until the thing is posted; the nightly
# cleanup leaves alone any upload a draft lists. A draft stays until it is
# posted or discarded.
class Draft < ApplicationRecord
  MAX_PER_COMPOSER = 50
  MAX_MEDIA = 1000
  MAX_PARAMS_BYTES = 256.kilobytes

  NAME_FORMAT = /\A[a-z][a-z0-9_]{0,39}\z/
  CONTEXT_FORMAT = /\A[a-z_]{1,20}:[A-Za-z0-9_-]{1,60}\z/

  belongs_to :account, inverse_of: :drafts

  validates :korner, :kind, format: { with: NAME_FORMAT }
  validates :context, format: { with: CONTEXT_FORMAT }, allow_nil: true
  validates :version, numericality: { only_integer: true, greater_than: 0 }
  validates :media_attachment_ids, length: { maximum: MAX_MEDIA }
  validate :korner_exists, if: :korner_changed?
  validate :params_shape
  validate :drafts_per_composer, on: :create

  scope :recent, -> { order(updated_at: :desc, id: :desc) }
  scope :for_composer, ->(korner, kind, context = nil) { where(korner: korner.to_s, kind: kind.to_s, context: context.presence) }

  def media_attachments
    return [] if media_attachment_ids.blank?

    by_id = account.media_attachments.where(id: media_attachment_ids).index_by(&:id)
    media_attachment_ids.filter_map { |id| by_id[id] }
  end

  private

  def korner_exists
    errors.add(:korner, 'is not a space on Kronk') if Kronk::KornerRegistry.find(korner).nil?
  end

  def params_shape
    return errors.add(:params, 'must be an object') unless params.is_a?(Hash)

    errors.add(:params, 'is too large') if params.to_json.bytesize > MAX_PARAMS_BYTES
  end

  def drafts_per_composer
    return unless account
    return if account.drafts.for_composer(korner, kind, context).count < MAX_PER_COMPOSER

    errors.add(:base, "You can keep up to #{MAX_PER_COMPOSER} drafts here")
  end
end
