# frozen_string_literal: true

# Trimmed shape of a MarketplaceListing for timeline embedding on the
# shared status. The full REST::MarketplaceListingSerializer includes
# account, media_attachments, timestamps etc. which we do not want to
# ship on every status. Mirrors REST::ProposalSummarySerializer.
class REST::MarketplaceListingSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :category, :subcategory,
             :price_display, :location, :status

  def id
    object.id.to_s
  end

  # Truncate long descriptions so a listing share doesn't balloon the
  # timeline payload. Card UI clamps to two lines anyway.
  def description
    text = object.description.to_s.strip
    return text if text.length <= 300

    "#{text[0, 297].rstrip}…"
  end
end
