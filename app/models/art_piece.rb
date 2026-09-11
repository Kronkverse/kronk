# frozen_string_literal: true

# Art — a single physical work by one author, with one or more photos
# of it (multiple angles / details of the same piece). Unlike an
# Albutts Album, an ArtPiece is single-contributor by design: photos
# of a sculpture from different angles are still authored by the
# artist. Krew scoping is not implemented in v1 (the model returns
# empty relations for the Reachable adapter) — the four reach tiers
# public/orbit/mates/self_only are the whole visibility axis.
#
# See docs/korners/art (TBD) and config/korners/art.yaml.
class ArtPiece < ApplicationRecord
  include Reachable

  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :status, optional: true, inverse_of: :art_piece

  has_many :photos, class_name: 'ArtPiecePhoto', dependent: :destroy, inverse_of: :art_piece

  # Physical-work discipline. `other` is the escape hatch for anything
  # the user's making that doesn't fit the six named kinds — assemblage,
  # textile, installation, etc. — until the taxonomy earns more slots.
  enum :kind,
       { painting: 0, sculpture: 1, print: 2, drawing: 3, ceramic: 4, photograph: 5, other: 6 },
       suffix: :kind

  # Reach ladder. Krew is not offered in v1 (see class comment).
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  validates :title, presence: true, length: { maximum: 240 }
  validates :description, length: { maximum: 4000 }, allow_blank: true

  scope :recent, -> { order(created_at: :desc) }

  # Reachable adapter — reach visibility (visible_to / visible_to?)
  # lives in the concern; these tell it how an ArtPiece stores its
  # owner and (that it has no) krew scoping.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(_krew_ids)
    none
  end

  private

  # Reachable adapter (instance side).
  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(_viewer)
    false
  end
end
