# frozen_string_literal: true

# A film, kar, kronikle, art piece or listing Konnected to a Krew is for the
# Krew: the Krew joins its audience (`record_krews`, Kronk::KrewAudience)
# and its feed post's. The same rule as an album's (Kronk::AlbumLinks),
# for every korner that keeps its Krews in `record_krews`.
#
# The link is a korner attachment, made from either end; the audience is
# what follows from it. Every way in comes through here: the Konnect picker
# from the record or the Krew (Kronk::AttachmentEffects), and the record's
# own Krews, picked in its composer's reach control or copied by "Same as"
# (RecordKrew keeps a link for each). Unlinking takes the Krew out of the
# audience.
#
# The Krew only becomes an audience when the record's owner links it and
# is in the Krew; a link someone else makes stays a link.
module Kronk
  module RecordKrewLinks
    module_function

    SLUGS = %w(art cinema karporn kronikles wachuneed).freeze

    # After `attachment` was saved by `actor`.
    def linked(attachment, actor)
      record, krew = resolve(attachment)
      share(record, krew, actor) if record && krew
    end

    # After `attachment` was removed.
    def unlinked(attachment)
      record, krew = resolve(attachment)
      return if record.nil? || krew.nil?
      return if AttachmentEffects.between(slug_of(attachment), record.id, 'krew', krew.id).exists?

      record.sync_audience_krews!(record.record_krews.pluck(:krew_id) - [krew.id])
    end

    # A RecordKrew row was made some other way: the link goes with it. Not
    # `create!`: a link that can't be made never stops the record saving.
    def audience_added(record_krew)
      slug = record_krew.korner_slug
      return if AttachmentEffects.between(slug, record_krew.record_id, 'krew', record_krew.krew_id).exists?

      owner_id = Kronk::Audience.owner_id_of(record_krew.record)
      KornerAttachment.create(source_slug: slug, source_id: record_krew.record_id, target_slug: 'krew', target_id: record_krew.krew_id,
                              kind: KornerAttachment::KIND_LINK, created_by_account_id: owner_id)
    end

    # A RecordKrew row went: so does the link.
    def audience_removed(record_krew)
      AttachmentEffects.between(record_krew.korner_slug, record_krew.record_id, 'krew', record_krew.krew_id).delete_all
    end

    def slug_of(attachment)
      ([attachment.source_slug, attachment.target_slug] - ['krew']).first
    end

    def resolve(attachment)
      slug = slug_of(attachment)
      record_id, _, krew_id = AttachmentEffects.ends(attachment, slug)
      [Kronk::KornerRegistry.model_for(slug)&.find_by(id: record_id), Krew.find_by(id: krew_id)]
    end

    def share(record, krew, actor)
      return unless Kronk::Audience.owner_id_of(record) == actor.id && krew.member?(actor) && !krew.archived?
      return if record.record_krews.exists?(krew_id: krew.id)

      record.sync_audience_krews!(record.record_krews.pluck(:krew_id) + [krew.id])
    end
  end
end
