# frozen_string_literal: true

# Attachment row + a minimal preview of each endpoint (spec §7 open item
# 3, drafted answer: return a minimal preview rather than serialising the
# whole target record). Each preview carries { slug, id, title, url } —
# just enough for a frontend list row. Full records are fetched on demand
# via the target korner's own API.
#
# Each preview also carries its record's `audience` (Kronk::Audience
# summary: `{ tier, krews: [{ id, name, slug }], hidden_krews, followable }`,
# or nil for a korner without one), so a tile can say "Same as" and when
# one end's audience doesn't reach the other's. `audience_follows` is the
# end that leads, when the other follows it: 'target' (the source follows
# the target), 'source', or nil. The index passes every row's audiences in
# at once (`audiences:`); one row works them out itself.
#
# And its `preview` (Kronk::KonnectedPreview: a Place's spot, an album's
# photos, an event's date), or nil, for the card the Konnected section draws.
class REST::KornerAttachmentSerializer < ActiveModel::Serializer
  attributes :id, :source_slug, :source_id,
             :target_slug, :target_id,
             :kind, :metadata, :audience_follows,
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

  def audience_follows
    object.metadata.is_a?(Hash) ? object.metadata[Kronk::Audience::FOLLOWS_KEY] : nil
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
      noun: Kronk::KornerRecords.noun_for(slug, record),
      url: record_url(slug, record),
      audience: audience_of(slug, record),
      preview: Kronk::KonnectedPreview.for(slug, record),
    }
  end

  def audience_of(slug, record)
    audiences = instance_options[:audiences]
    return audiences[[slug, record.id]] if audiences

    Kronk::Audience.summary(record, current_user&.account)
  end

  def record_title(record)
    Kronk::KornerRecords.title_of(record)
  end

  def record_url(slug, record)
    Kronk::KornerRecords.path_for(slug, record)
  end
end
