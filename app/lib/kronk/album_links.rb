# frozen_string_literal: true

# An album linked to a Krew is one of the Krew's albums: the Krew joins its
# audience (`album_krews`) and its posts' (`statuses_krews`), and the Krew
# page lists it (docs/spaces/krew.md, Linking).
#
# The link is a korner attachment, made from either end; the audience is
# what follows from it. Every way in comes through here: the Attach picker
# from the album or the Krew (Kronk::AttachmentEffects), the Krew's "Link
# one of your albums", and the album's own Krews, picked in its composer or
# given to a Krew (AlbumKrew keeps a link for each). Unlinking from any of
# them takes the album out of the Krew's audience.
#
# The Krew only becomes an audience when the album's owner links it and is
# in the Krew, as the Krew's own Link button requires. A link someone else
# makes stays a link. A Krew album (`albums.krew_id`) is its Krew's for
# good, so that link can't be taken off; it can be linked to other Krews
# like any record, but its audience stays its own Krew's.
module Kronk
  module AlbumLinks
    module_function

    # After `attachment` was saved by `actor`.
    def linked(attachment, actor)
      album, krew = resolve(attachment)
      share(album, krew, actor) if album && krew
    end

    # After `attachment` was removed.
    def unlinked(attachment)
      album, krew = resolve(attachment)
      return if album.nil? || krew.nil? || album.krew_id == krew.id
      return if AttachmentEffects.between('albutts', album.id, 'krew', krew.id).exists?

      remove(album, krew)
    end

    def removable?(attachment)
      album, krew = resolve(attachment)
      album.nil? || krew.nil? || album.krew_id != krew.id
    end

    # The Krew page's Link button.
    def link!(album, krew, actor)
      AttachmentEffects.link!('albutts', album.id, 'krew', krew.id, actor)
    end

    # The Krew page's Unlink button.
    def unlink!(album, krew)
      AttachmentEffects.unlink!('albutts', album.id, 'krew', krew.id)
      remove(album, krew)
    end

    # An AlbumKrew row was made some other way (the album's composer,
    # giving it to a Krew, a Krew album being made): the link goes with it.
    # Not `create!`: a link that can't be made never stops the album saving.
    def audience_added(album_krew)
      return if AttachmentEffects.between('albutts', album_krew.album_id, 'krew', album_krew.krew_id).exists?

      KornerAttachment.create(source_slug: 'albutts', source_id: album_krew.album_id, target_slug: 'krew', target_id: album_krew.krew_id,
                              kind: KornerAttachment::KIND_LINK, created_by_account_id: album_krew.album.owner_id)
    end

    # An AlbumKrew row went (the composer dropped the Krew, the album or
    # the Krew was deleted): so does the link.
    def audience_removed(album_krew)
      AttachmentEffects.between('albutts', album_krew.album_id, 'krew', album_krew.krew_id).delete_all
    end

    def resolve(attachment)
      album_id, _, krew_id = AttachmentEffects.ends(attachment, 'albutts')
      [Album.find_by(id: album_id), Krew.find_by(id: krew_id)]
    end

    def share(album, krew, actor)
      return if album.krew_album?
      return unless album.owner_id == actor.id && krew.member?(actor) && !krew.archived?

      album.album_krews.find_or_create_by!(krew: krew)
      StatusKrews.add(album.post_status_ids, krew.id)
      krew.krew_korners.find_or_create_by!(korner: 'albutts')
    end

    def remove(album, krew)
      album.album_krews.where(krew_id: krew.id).destroy_all
      StatusKrews.remove(album.post_status_ids, krew.id)
    end
  end
end
