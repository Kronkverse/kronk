# frozen_string_literal: true

# Kronk::KrewAudience — the Krews a korner record is for, on top of its
# reach tier (Reachable's additive Krew axis), kept in one table for every
# korner that has no Krew column of its own: `record_krews` (korner slug +
# record id + Krew). Films, kars, kronikles, art pieces and listings use it
# (decisions.md, 2026-10-25); albums keep `album_krews` and Moments their
# `krew_id`.
#
# Works like an album's Krews: a member of any of them sees the record
# whatever its tier, its feed post carries them (`statuses_krews`), and
# each is a Konnection to the Krew (RecordKrew, Kronk::RecordKrewLinks).
# The including model wires Reachable's hooks to `audience_krew_scope` and
# `audience_krew_member?`, and sets `attachment_source_slug`.
module Kronk
  module KrewAudience
    extend ActiveSupport::Concern

    included do
      model = self
      has_many :record_krews, -> { where(korner_slug: model.attachment_source_slug) },
               foreign_key: :record_id, dependent: :destroy, inverse_of: false
      has_many :krews, through: :record_krews
    end

    class_methods do
      # Records for any of `krew_ids` (an id list or a subquery).
      def audience_krew_scope(krew_ids)
        where(id: RecordKrew.where(korner_slug: attachment_source_slug, krew_id: krew_ids).select(:record_id))
      end
    end

    # Make the record's Krews exactly `krew_ids`, and its feed post's with them.
    def sync_audience_krews!(krew_ids)
      wanted = Array(krew_ids).map(&:to_i).uniq
      before = record_krews.pluck(:krew_id)
      record_krews.where.not(krew_id: wanted).destroy_all
      (wanted - before).each { |krew_id| record_krews.create!(krew_id: krew_id) }
      Kronk::StatusKrews.add(status_id, wanted - before)
      Kronk::StatusKrews.remove(status_id, before - wanted)
      record_krews.reset
    end

    private

    def audience_krew_member?(viewer)
      viewer.present? && record_krews.exists?(krew_id: viewer.krews.select(:id))
    end
  end
end
