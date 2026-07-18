# frozen_string_literal: true

# A file attached to a proposal — a mockup, a written brief, or a reference.
#
# Read by implementers, not browsers. Files are stored with private
# permissions and streamed through an authenticated controller with a
# download disposition, because an attachment may legitimately be HTML and
# serving that inline from object storage would be an XSS surface.
class ProposalAttachment < ApplicationRecord
  MAX_SIZE = 15.megabytes

  # What the file is for, so an implementer knows how to read it without
  # opening every attachment on a proposal.
  #
  #   mockup    — a rendered design: HTML, an image, a PDF
  #   brief     — written instructions describing what to build
  #   reference — supporting material; an example, a spec extract, data
  enum :kind, { mockup: 0, brief: 1, reference: 2 }

  CONTENT_TYPES = %w(
    text/html text/markdown text/plain text/yaml application/json
    application/pdf image/png image/jpeg image/gif image/webp image/svg+xml
  ).freeze

  belongs_to :proposal
  belongs_to :account

  # Uses the default Paperclip path, like every other attachment in the app.
  #
  # Spec §5 wants korner media under `spaces/<korner>/<resource>/<id>/`, and
  # kommons.yaml declares a `media_prefix` for it — but nothing in the
  # codebase writes under `spaces/` yet, and the interpolations to do so do
  # not exist. Implementing that layout here alone would put one korner's
  # media somewhere no other code knows to look. It is a cross-korner
  # migration, tracked separately.
  has_attached_file :file,
                    s3_permissions: ->(*) { ENV['S3_PERMISSION'] == '' ? nil : 'private' }

  validates_attachment_content_type :file, content_type: CONTENT_TYPES
  validates_attachment_size :file, less_than: MAX_SIZE
  validates_attachment_presence :file
  validates :description, length: { maximum: 2_000 }

  scope :recent, -> { order(created_at: :asc) }

  def filename
    file_file_name
  end

  def byte_size
    file_file_size
  end
end
