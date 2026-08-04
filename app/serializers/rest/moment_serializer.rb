# frozen_string_literal: true

# Full Moment shape. Used by /api/v1/moments (create/show/index) and
# by the composer / grid / strip views. Moments have no feed card, so
# this is the only Moment serializer.
class REST::MomentSerializer < ActiveModel::Serializer
  attributes :id, :caption, :visibility, :expires_at, :active,
             :froth_count, :frothed_by_viewer, :seen_by_viewer, :created_at,
             :voice_url

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
    # `scope` is the current User, not an Account; frothed_by? matches on
    # account_id, so pass the account (matching seen_by_viewer / the serializer
    # convention). Passing the User compared account_id against user.id and
    # always came back false. frothed_by? handles a nil account.
    object.frothed_by?(current_user&.account)
  end

  # Whether the viewer has seen this Moment — drives the dim/bright ring in the
  # Home strip. A Moment is seen once viewed (opened in the viewer) or frothed;
  # see Kronk::KornerSeen. Moments are keyed under the 'moments' slug.
  def seen_by_viewer
    Kronk::KornerSeen.seen?(current_user&.account, 'moments', object.id)
  end

  # URL to the paired voice clip on a photo+voice Moment, or nil for
  # a photo-only / video Moment. Client uses this to render the
  # <VoicePlayer> overlay + the mic-glyph ring indicator on the
  # Home strip.
  def voice_url
    object.voice_media_attachment&.file&.url(:original)
  end
end
