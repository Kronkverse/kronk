# frozen_string_literal: true

# What a link to something on Kronk shows when it's shared: the thing's
# title, a line about it and its picture, looked up as the person who'll see
# the card (Tal, 2026-10-19: previews of internal links, every korner,
# everywhere). Used by Api::V1::LinkPreviewsController; the web draws the
# result as a <KronkLinkCard> in posts, Nudges messages and FreeTheDream
# Talk.
#
# A korner's detail pages are `/hub/<slug>/<id>` or `/hub/<slug>/<word>/<id>`
# (an album is /hub/albutts/albums/12, an event /hub/kalendar/12), and the id
# is a row of the korner's primary resource, the model
# `KornerRegistry.model_for` already finds for korner attachments. So a new
# korner whose pages follow that shape previews with nothing added. The few
# pages that hold something else are in OTHER_RECORDS.
#
# Nothing is shown to someone who can't see it: Kronk::KornerRecords says
# who can see what, the same rule korner attachments use. Anything it can't
# answer is treated as private and resolves to nil; the card then names only
# the korner.
module Kronk
  module LinkPreview
    module_function

    HUB_PATH = %r{\A/hub/(?<slug>[a-z0-9-]+)(?<rest>(?:/[^/?#]+)*)/?\z}
    SUMMARY_MAX = 160

    # Pages whose id isn't the korner's primary resource, by korner and the
    # word before the id. `nil` means the page has no card of its own (the
    # korner's card stands in).
    OTHER_RECORDS = {
      'freethedream' => { 'i' => 'Freethedream::Item' },
      'kommons' => { 'node' => nil, 'space' => nil },
      'wachuneed' => { 'shop' => nil },
    }.freeze

    # The preview of one URL for `viewer`, or nil when it isn't a Kronk
    # page, the thing is gone, or the viewer can't see it.
    def call(url, viewer)
      path = local_path(url)
      return nil unless path

      match = HUB_PATH.match(path)
      return nil unless match

      slug = match[:slug]
      return nil unless Kronk::KornerRegistry.find(slug)

      record = find_record(slug, match[:rest].split('/').compact_blank)
      return nil unless record && visible?(record, viewer)

      card(slug, record).merge(url: path)
    end

    # The path of a Kronk URL (this instance's domain, or a bare path).
    def local_path(url)
      uri = Addressable::URI.parse(url.to_s.strip)
      return nil if uri.host.present? && !TagManager.instance.local_url?(uri.to_s)
      return nil if uri.path.blank?

      uri.path
    rescue Addressable::URI::InvalidURIError
      nil
    end

    # /hub/<slug>/<id>…, or /hub/<slug>/<word>/<id>… (anything after the id,
    # like /edit or /audit, is still that record's page).
    def find_record(slug, segments)
      return nil if segments.empty?

      word, id = segments[0].match?(/\A\d+\z/) ? [nil, segments[0]] : segments.first(2)
      model = model_for(slug, word)
      return nil if model.nil?

      id ||= word if model == Krew # /hub/krew/:slug
      return nil if id.blank?

      model == Krew ? Krew.find_by(slug: id) || Krew.find_by(id: id.to_i) : model.find_by(id: id)
    end

    def model_for(slug, word)
      others = OTHER_RECORDS.fetch(slug, {})
      return others[word]&.safe_constantize if word && others.key?(word)

      Kronk::KornerRegistry.model_for(slug)
    end

    def visible?(record, viewer)
      Kronk::KornerRecords.visible?(record, viewer)
    end

    def card(slug, record)
      {
        korner: slug,
        title: title_of(record),
        summary: summary_of(record),
        image: image_of(record),
        when: record.try(:start_time)&.iso8601,
      }
    end

    def title_of(record)
      Kronk::KornerRecords.title_of(record)
    end

    def summary_of(record)
      %i(summary description about body prompt caption).each do |field|
        value = record.try(field)
        next unless value.is_a?(String)

        text = ActionController::Base.helpers.strip_tags(value).squish
        return text.truncate(SUMMARY_MAX, separator: ' ') if text.present? && text != title_of(record)
      end
      nil
    end

    # The picture: a cover or image if it has one, else its first photo.
    def image_of(record)
      %i(cover_media_attachment cover cover_attachment image media_attachment video_media_attachment).each do |field|
        next unless record.respond_to?(field)

        url = picture_url(record.public_send(field))
        return url if url
      end

      %i(listing_photos photos pictures).each do |field|
        next unless record.respond_to?(field)

        first = record.public_send(field).first
        url = picture_url(first.respond_to?(:media_attachment) ? first.media_attachment : first)
        return url if url
      end
      nil
    end

    def picture_url(attachment)
      case attachment
      when MediaAttachment
        if attachment.image?
          attachment.file.url(:small)
        elsif attachment.thumbnail.present?
          attachment.thumbnail.url(:original)
        end
      when Paperclip::Attachment
        attachment.url(:original) if attachment.present?
      end
    end
  end
end
