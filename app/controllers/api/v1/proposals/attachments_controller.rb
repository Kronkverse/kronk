# frozen_string_literal: true

# Files attached to a proposal — mockups, briefs, references.
#
# `show` streams the file rather than redirecting to object storage, and
# always with an attachment disposition. Attachments may be HTML, and
# serving that inline would execute it in the user's session.
class Api::V1::Proposals::AttachmentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :set_proposal
  before_action :set_attachment, only: [:show, :destroy]

  def index
    render json: @proposal.proposal_attachments.recent,
           each_serializer: REST::ProposalAttachmentSerializer
  end

  def show
    send_file_contents(@attachment)
  end

  def create
    attachment = @proposal.proposal_attachments.new(
      account: current_account,
      kind: params[:kind].presence || 'mockup',
      description: params[:description],
      file: params[:file]
    )

    if attachment.save
      render json: attachment, serializer: REST::ProposalAttachmentSerializer, status: 201
    else
      render json: { error: attachment.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    return render json: { error: 'Only the uploader can remove an attachment.' }, status: 403 unless @attachment.account_id == current_account.id # rubocop:disable I18n/RailsI18n/DecorateString

    @attachment.destroy!
    render_empty
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:proposal_id])
  end

  def set_attachment
    @attachment = @proposal.proposal_attachments.find(params[:id])
  end

  # Streams from wherever Paperclip put it — local disk or object storage —
  # so the file never needs to be publicly readable.
  def send_file_contents(attachment)
    # copy_to_local_file takes (style, destination) — it writes into the path
    # you give it and returns the write result, not a file handle.
    Tempfile.create(['proposal-attachment', File.extname(attachment.filename.to_s)]) do |tmp|
      attachment.file.copy_to_local_file(:original, tmp.path)
      send_data File.binread(tmp.path),
                filename: attachment.filename,
                type: 'application/octet-stream',
                disposition: 'attachment'
    end
  rescue => e
    Rails.logger.error("Failed to stream attachment #{attachment.id}: #{e.class} #{e.message}")
    render json: { error: 'Attachment could not be read.' }, status: 500 # rubocop:disable I18n/RailsI18n/DecorateString
  end
end
