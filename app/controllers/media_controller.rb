# frozen_string_literal: true

class MediaController < ApplicationController
  include Authorization

  skip_before_action :require_functional!, unless: :limited_federation_mode?

  before_action :authenticate_user!, if: :limited_federation_mode?
  before_action :set_media_attachment
  before_action :verify_permitted_status!
  before_action :check_playable, only: :player
  before_action :allow_iframing, only: :player

  content_security_policy only: :player do |policy|
    policy.frame_ancestors(false)
  end

  def show
    redirect_to @media_attachment.file.url(:original)
  end

  def player; end

  # Kronk: the lightbox Download button. Media is served from the storage
  # host (S3_ALIAS_HOST), a different origin, so the browser ignores the
  # `download` attribute there and just opens the file. This goes through
  # the same visibility check as `show`, then hands the browser a
  # short-lived signed URL whose response carries
  # `Content-Disposition: attachment`, so it saves instead of opening. A
  # redirect rather than a proxy: large videos never pass through Rails.
  def download
    disposition = ActionDispatch::Http::ContentDisposition.format(disposition: 'attachment', filename: download_filename)

    if @media_attachment.file.respond_to?(:s3_object)
      url = @media_attachment.file.s3_object(:original).presigned_url(
        :get,
        expires_in: DOWNLOAD_URL_TTL.to_i,
        response_content_disposition: disposition
      )
      redirect_to url, allow_other_host: true
    else
      send_file @media_attachment.file.path(:original), filename: download_filename, disposition: 'attachment', type: @media_attachment.file_content_type
    end
  end

  DOWNLOAD_URL_TTL = 5.minutes

  private

  def download_filename
    "kronk-#{@media_attachment.id}#{File.extname(@media_attachment.file_file_name.to_s).downcase}"
  end

  def set_media_attachment
    id = params[:id] || params[:medium_id]
    return if id.nil?

    scope = MediaAttachment.local.attached
    # If id is 19 characters long, it's a shortcode, otherwise it's an identifier
    @media_attachment = id.size == 19 ? scope.find_by!(shortcode: id) : scope.find(id)
  end

  def verify_permitted_status!
    authorize @media_attachment.status, :show?
  rescue ActiveRecord::RecordNotFound, Mastodon::NotPermittedError
    not_found
  end

  def check_playable
    not_found unless @media_attachment.larger_media_format?
  end

  def allow_iframing
    response.headers.delete('X-Frame-Options')
  end
end
