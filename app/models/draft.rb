# frozen_string_literal: true

# == Schema Information
#
# Table name: drafts
#
#  id                   :bigint(8)        not null, primary key
#  account_id           :bigint(8)        not null
#  params               :jsonb            not null
#  media_attachment_ids :bigint           default([]), not null, is an Array
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#

# A single rolling autosave buffer for the composer — one per account. The web
# composer PUTs its state here (debounced) so nothing is lost on navigation, a
# refresh, or a device switch; the composer restores it on mount and clears it
# on publish. Mirrors ScheduledStatus (params jsonb + media by id) without the
# schedule.
class Draft < ApplicationRecord
  belongs_to :account, inverse_of: :draft

  # Media are referenced by id (unattached MediaAttachment rows the composer
  # already uploaded). Order is preserved; only the account's own media resolve.
  # A long-abandoned draft may lose media to the unattached-media cleanup.
  def media_attachments
    return [] if media_attachment_ids.blank?

    by_id = account.media_attachments.where(id: media_attachment_ids).index_by(&:id)
    media_attachment_ids.filter_map { |id| by_id[id] }
  end
end
