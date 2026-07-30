# frozen_string_literal: true

# Full Moment shape. Used by /api/v1/moments (create/show/index) and
# by the composer / grid / strip views. Moments have no feed card, so
# this is the only Moment serializer.
class REST::MomentSerializer < ActiveModel::Serializer
  attributes :id, :caption, :visibility, :expires_at, :active,
             :froth_count, :frothed_by_viewer, :created_at

  belongs_to :account, serializer: REST::AccountSerializer
  belongs_to :media_attachment, serializer: REST::MediaAttachmentSerializer
  belongs_to :krew, serializer: REST::KrewSerializer

  def id
    object.id.to_s
  end

  def expires_at
    object.expires_at.iso8601
  end

  def created_at
    object.created_at.iso8601
  end

  def active
    object.active?
  end

  def frothed_by_viewer
    return false unless scope

    object.frothed_by?(scope)
  end
end
