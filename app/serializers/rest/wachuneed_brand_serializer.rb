# frozen_string_literal: true

# A brand in Wachuneed's Brands (docs/spaces/wachuneed.md, Brands). A tile
# needs the name, picture, category and how many back it; the brand's page
# (`detail: true`) adds the backers' faces and the picture's id for the
# edit form. Every one says whether the viewer backs it and what they may
# do with it, and how many backers a brand needs, so the client holds no
# copy of the number.
class REST::WachuneedBrandSerializer < ActiveModel::Serializer
  attributes :id, :name, :url, :why, :category, :picture_url, :backers_count,
             :backers_to_list, :listed, :backed, :can_edit, :can_remove,
             :account, :created_at

  attribute :picture_id, if: :detail?
  attribute :backers, if: :detail?

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

  def backers_count
    object.backers_count
  end

  def backers_to_list
    WachuneedBrand::BACKERS_TO_LIST
  end

  def listed
    object.listed?
  end

  def backed
    object.backed_by?(viewer)
  end

  def can_edit
    policy.update?
  end

  def can_remove
    policy.destroy?
  end

  # Who proposed it.
  def account
    face(object.account)
  end

  # Who backs it, the first to back first (the proposer, then in order).
  def backers
    object.backings.includes(:account).order(:created_at, :id).limit(WachuneedBrand::MAX_FACES).filter_map do |backing|
      face(backing.account) if backing.account
    end
  end

  private

  def viewer
    instance_options[:viewer]
  end

  def policy
    @policy ||= WachuneedBrandPolicy.new(viewer, object)
  end

  def face(account)
    ActiveModelSerializers::SerializableResource
      .new(account, serializer: REST::AccountSerializer)
      .as_json
      .slice(:id, :acct, :display_name, :avatar, :avatar_static)
  end
end
