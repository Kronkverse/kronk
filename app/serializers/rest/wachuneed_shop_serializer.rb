# frozen_string_literal: true

# A Wachuneed shop front. A shop's card needs the name, picture, owner, how
# much is in it and a few photos of what; the shop page (`detail: true`)
# adds the sections and the listings to put under them and whether the
# visitor may message the seller, and the owner's edit form reads its two
# settings.
class REST::WachuneedShopSerializer < ActiveModel::Serializer
  attributes :id, :name, :description, :picture_url, :listings_count,
             :visibility, :show_on_profile, :account, :based_in, :preview_photos

  attribute :sections, if: :detail?
  attribute :listings, if: :detail?
  attribute :picture_id, if: :detail?
  attribute :payment, if: :detail?
  attribute :handover, if: :detail?
  attribute :about, if: :detail?
  attribute :can_message, if: :detail?

  def detail?
    instance_options[:detail].present?
  end

  def id
    object.id.to_s
  end

  def picture_url
    object.media_attachment&.file&.url(:small)
  end

  def picture_id
    object.media_attachment_id&.to_s
  end

  def listings_count
    counts = instance_options[:listing_counts]
    counts ? counts[object.account_id].to_i : object.live_offers(instance_options[:viewer]).count
  end

  # Cover photos of the newest items, for the card and the banner.
  def preview_photos
    previews = instance_options[:previews] || ListingShop.preview_photos_for([object.account_id], instance_options[:viewer])
    previews.fetch(object.account_id, [])
  end

  # Whoever can see the shop can message the seller from it; never the
  # seller, never across a block (docs/spaces/wachuneed.md, Who can see it).
  def can_message
    ListingShop.messageable?(object.account, sender: instance_options[:viewer])
  end

  def account
    ActiveModelSerializers::SerializableResource
      .new(object.account, serializer: REST::AccountSerializer)
      .as_json
      .slice(:id, :acct, :display_name, :avatar, :avatar_static)
  end

  def sections
    object.sections.map { |section| { id: section.id.to_s, name: section.name } }
  end

  # The shop's live offers the visitor can see, in the seller's order; each
  # carries `shop_section_id` so the page can sort them under their sections.
  def listings
    offers = object.live_offers(instance_options[:viewer]).includes(:listing_photos).in_shop_order.limit(200).to_a
    Kronk::RecordPlace.preload(offers).map do |listing|
      REST::WachuneedListingSummarySerializer.new(listing).as_json
    end
  end
end
