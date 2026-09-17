# frozen_string_literal: true

# Attachment row + a minimal preview of each endpoint (spec §7 open item
# 3, drafted answer: return a minimal preview rather than serialising the
# whole target record). Each preview carries { slug, id, title, url } —
# just enough for a frontend list row. Full records are fetched on demand
# via the target korner's own API.
class REST::KornerAttachmentSerializer < ActiveModel::Serializer
  attributes :id, :source_slug, :source_id,
             :target_slug, :target_id,
             :kind, :metadata,
             :created_at, :source, :target

  def id
    object.id.to_s
  end

  def source_id
    object.source_id.to_s
  end

  def target_id
    object.target_id.to_s
  end

  def source
    preview(object.source_slug, object.source_record)
  end

  def target
    preview(object.target_slug, object.target_record)
  end

  private

  def preview(slug, record)
    return { slug: slug, id: nil, title: nil, url: nil, missing: true } unless record

    {
      slug: slug,
      id: record.id.to_s,
      title: record_title(record),
      url: record_url(slug, record),
    }
  end

  def record_title(record)
    %i(title name display_name).each do |method|
      return record.public_send(method) if record.respond_to?(method) && record.public_send(method).is_a?(String)
    end
    nil
  end

  def record_url(slug, record)
    "/hub/#{slug}/#{record.id}"
  end
end
