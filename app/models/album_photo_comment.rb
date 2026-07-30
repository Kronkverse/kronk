# frozen_string_literal: true

# A comment on a single AlbumPhoto — the discussion surface inside the
# lightbox. Mirrors ProposalComment: one level of threading via
# `parent`, and a reply cannot itself be replied to (flat depth-2).
class AlbumPhotoComment < ApplicationRecord
  belongs_to :album_photo, inverse_of: :comments
  belongs_to :account
  belongs_to :parent, class_name: 'AlbumPhotoComment', optional: true, inverse_of: :replies

  has_many :replies, class_name: 'AlbumPhotoComment', foreign_key: :parent_id,
                     dependent: :destroy, inverse_of: :parent

  validates :body, presence: true, length: { maximum: 2_000 }
  validate :parent_on_same_photo
  validate :parent_is_a_root

  scope :roots, -> { where(parent_id: nil) }
  scope :chronological, -> { order(:created_at) }

  after_commit :publish_commented_event, on: :create

  private

  def parent_on_same_photo
    return if parent.nil?

    errors.add(:parent, 'must belong to the same photo') if parent.album_photo_id != album_photo_id
  end

  def parent_is_a_root
    errors.add(:parent, 'cannot be a reply') if parent&.parent_id.present?
  end

  # albutts.photo.commented — nudges event bus routes to the photo
  # contributor for a root comment, and to the root author (thread
  # participants) for a reply.
  def publish_commented_event
    Kronk::KornerEvents.publish(
      'albutts.photo.commented',
      actor_account_id: account_id,
      album_id: album_photo.album_id,
      photo_id: album_photo_id,
      comment_id: id,
      parent_id: parent_id,
      contributor_account_id: album_photo.contributor_id,
      parent_author_account_id: parent&.account_id
    )
  end
end
