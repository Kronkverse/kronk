# frozen_string_literal: true

# Anthemos phones linked to your account (docs/spaces/map.md, Live location).
#
#   GET    /api/v1/anthemos/links      — yours, for Account & Security
#   POST   /api/v1/anthemos/links      — link this phone (public key + proof)
#   DELETE /api/v1/anthemos/links/:id  — unlink; its live shares end at once
#
# Linking proves the phone holds the key: it signs
# "anthemos-link-v1\n<account id>\n<public key>".
class Api::V1::Anthemos::LinksController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :destroy]
  before_action :require_user!

  def index
    links = AnthemosLink.where(account: current_account).order(created_at: :desc)
    sharing = LiveShare.active.where(anthemos_link_id: links.select(:id)).group(:anthemos_link_id).count
    render json: links.map { |link| project(link, sharing.fetch(link.id, 0)) }
  end

  def create
    key = params.require(:public_key).to_s
    unless Kronk::AnthemosSignature.valid?(key, params.require(:signature), 'anthemos-link-v1', current_account.id, key)
      return render json: { error: 'bad_signature' }, status: 422
    end

    link = AnthemosLink.find_or_initialize_by(account: current_account, public_key: key)
    link.update!(device_name: params.require(:device_name).to_s.strip.first(60), last_used_at: Time.current)
    render json: project(link, 0)
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end

  def destroy
    AnthemosLink.find_by!(account: current_account, id: params[:id]).unlink!
    head 204
  end

  private

  def project(link, sharing)
    {
      id: link.id.to_s,
      device_name: link.device_name,
      created_at: link.created_at.iso8601,
      last_used_at: link.last_used_at&.iso8601,
      live_shares: sharing,
    }
  end
end
