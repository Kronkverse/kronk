# frozen_string_literal: true

# What a link does besides being a link (docs/korners/adding_a_korner.md
# (Korner attachments) §2.5). Most links are only a row in
# `korner_attachments`. A few pairs keep something else in step with the
# row: an event or album linked to a Krew joins the Krew's audience, so the
# Krew's members can open it and the Krew page lists it.
#
# Every way of linking such a pair goes through here, so the row and what
# follows from it always agree: the Attach picker from either end, the
# Krew page's own Link buttons, and unlinking from any of them. A pair
# behaves the same whichever end made the link (album → krew or
# krew → album); a handler reads the two ends with `ends`.
#
# A pair's handler is a module with `linked(attachment, actor)` and
# `unlinked(attachment)`, and optionally `removable?(attachment)`. Add one
# to `handlers` for a new pair.
module Kronk
  module AttachmentEffects
    module_function

    # Unordered pairs of korner slugs (sorted) and the handler for each.
    def handlers
      {
        %w(kalendar krew) => Kronk::EventLinks,
        %w(freethedream kalendar) => Kronk::EventLinks,
        %w(albutts krew) => Kronk::AlbumLinks,
      }
    end

    def handler_for(attachment)
      return nil unless attachment.kind == KornerAttachment::KIND_LINK

      handlers[[attachment.source_slug.to_s, attachment.target_slug.to_s].sort]
    end

    # After `attachment` was saved by `actor`.
    def linked(attachment, actor)
      handler_for(attachment)&.linked(attachment, actor)
    end

    # After `attachment` was removed.
    def unlinked(attachment)
      handler_for(attachment)&.unlinked(attachment)
    end

    # Whether the link may be taken off at all (a Krew's own album stays
    # linked to its Krew).
    def removable?(attachment)
      handler = handler_for(attachment)
      handler.nil? || !handler.respond_to?(:removable?) || handler.removable?(attachment)
    end

    # The end in `slug`'s korner and the other one, as
    # [id in slug, other slug, other id], whichever way the link points.
    def ends(attachment, slug)
      if attachment.source_slug == slug
        [attachment.source_id, attachment.target_slug, attachment.target_id]
      else
        [attachment.target_id, attachment.source_slug, attachment.source_id]
      end
    end

    # The links between two records, made from either end.
    def between(slug_a, id_a, slug_b, id_b)
      links = KornerAttachment.where(kind: KornerAttachment::KIND_LINK)
      links.where(source_slug: slug_a, source_id: id_a, target_slug: slug_b, target_id: id_b)
           .or(links.where(source_slug: slug_b, source_id: id_b, target_slug: slug_a, target_id: id_a))
    end

    # Link two records on `actor`'s behalf (the Krew page's Link buttons),
    # unless they already are, and apply what follows either way.
    def link!(source_slug, source_id, target_slug, target_id, actor)
      attachment = between(source_slug, source_id, target_slug, target_id).first ||
                   KornerAttachment.create!(source_slug: source_slug, source_id: source_id, target_slug: target_slug, target_id: target_id,
                                            kind: KornerAttachment::KIND_LINK, created_by_account: actor)
      linked(attachment, actor)
      attachment
    end

    # Take every link between two records off, from either end.
    def unlink!(slug_a, id_a, slug_b, id_b)
      between(slug_a, id_a, slug_b, id_b).to_a.each do |attachment|
        attachment.destroy
        unlinked(attachment)
      end
    end
  end
end
