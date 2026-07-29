# frozen_string_literal: true

# Albutts — a shared album is a metadata container. Photos live on each
# contributor's account (via MediaAttachment) or, once Anthemos ships,
# on an external pod URL. The album itself is just the wrapper: title,
# description, cover, visibility, and the graph of who has contributed.
#
# See docs/spaces/albutts.md.
class Album < ApplicationRecord
  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :event, optional: true, inverse_of: :spawned_album
  belongs_to :status, optional: true, inverse_of: :album

  has_many :photos, class_name: 'AlbumPhoto', dependent: :destroy, inverse_of: :album
  has_many :album_krews, dependent: :destroy
  has_many :krews, through: :album_krews

  enum :visibility, { public: 0, mates: 1, krew: 2 }, suffix: :scope

  validates :title, presence: true, length: { maximum: 240 }
  validates :description, length: { maximum: 4000 }, allow_blank: true
  validate  :krew_scope_has_at_least_one_krew

  scope :recent, -> { order(created_at: :desc) }

  # Albums visible to `viewer`:
  #   * public → everyone
  #   * mates  → viewer is a mate of the owner (mutual follow)
  #   * krew   → viewer belongs to at least one of the album's krews
  #   * own    → the owner always sees their own albums regardless of scope
  scope :visible_to, lambda { |viewer|
    return public_scope if viewer.nil?

    mate_ids = viewer.mates.select(:id)
    krew_ids = viewer.krews.select(:id)

    where(owner_id: viewer.id)
      .or(public_scope)
      .or(mates_scope.where(owner_id: mate_ids))
      .or(krew_scope.where(id: AlbumKrew.where(krew_id: krew_ids).select(:album_id)))
  }

  # Distinct set of accounts who have contributed at least one photo
  # to this album. Ordered by their first contribution (oldest first)
  # so the "who's building this" avatar strip is stable.
  def contributor_accounts
    Account.where(id: photos.select(:contributor_id).distinct)
  end

  def visible_to?(viewer)
    return true if viewer && viewer.id == owner_id
    return true if public_scope?
    return mates_visible_to?(viewer) if mates_scope?
    return krew_visible_to?(viewer) if krew_scope?

    false
  end

  # Anyone who can view can also contribute — open-roster within
  # scope, per the spec.
  def contributable_by?(viewer)
    visible_to?(viewer)
  end

  private

  def mates_visible_to?(viewer)
    return false if viewer.nil?

    viewer.mates.exists?(id: owner_id) || viewer.id == owner_id
  end

  def krew_visible_to?(viewer)
    return false if viewer.nil?

    album_krews.where(krew_id: viewer.krews.select(:id)).exists?
  end

  def krew_scope_has_at_least_one_krew
    return unless krew_scope?
    return if new_record? && album_krews.any?
    return if persisted? && album_krews.exists?

    errors.add(:krews, 'must include at least one krew when visibility is krew-scoped')
  end
end
