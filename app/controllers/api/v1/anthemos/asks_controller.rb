# frozen_string_literal: true

# Asks from Kronk to Anthemos (docs/spaces/map.md, Asks from Kronk).
#
#   POST /api/v1/anthemos/asks               — the website asks (kind, payload)
#   GET  /api/v1/anthemos/asks/:token        — the phone reads it; the website
#                                              watches it for the answer
#   POST /api/v1/anthemos/asks/:token/answer — the phone answers, signed
#
# Every ask belongs to the account that made it: any other sign-in gets a 404,
# so a phone linked to another account can't read or answer it. The phone signs
# "anthemos-answer-v1\n<token>\n<link id>\n<outcome>\n<result>", each exactly
# as sent, with the key it linked with.
class Api::V1::Anthemos::AsksController < Api::BaseController
  include RoutingHelper

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :answer]
  before_action :require_user!

  def show
    render json: project(find_ask)
  end

  def create
    return render(json: { error: 'no_phone' }, status: 422) unless AnthemosLink.exists?(account: current_account)

    AnthemosAsk.where(account: current_account, created_at: ...AnthemosAsk::KEPT.ago).delete_all
    ask = AnthemosAsk.create!(account: current_account, kind: params.require(:kind).to_s,
                              payload: params.fetch(:payload, {}).permit(:to).to_h)
    render json: project(ask)
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end

  def answer
    ask = find_ask
    link = AnthemosLink.find_by!(account: current_account, id: params.require(:link_id))
    outcome = params.require(:outcome).to_s
    result = params[:result].to_s
    return render(json: { error: 'bad_outcome' }, status: 422) unless AnthemosAsk::ANSWERS.include?(outcome)
    return render(json: { error: ask.state }, status: 410) unless ask.waiting?
    return render(json: { error: 'bad_signature' }, status: 422) unless link.verify?(params.require(:signature), 'anthemos-answer-v1', ask.token, link.id, outcome, result)

    ask.answer!(link: link, outcome: outcome, result: result)
    render json: project(ask)
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  end

  private

  def find_ask
    AnthemosAsk.find_by!(account: current_account, token: params[:id].to_s)
  end

  def project(ask)
    {
      id: ask.token,
      kind: ask.kind,
      status: ask.state,
      result: ask.result,
      expires_at: ask.expires_at.iso8601,
      account: person(ask.account),
      to: (person(ask.recipient) if ask.recipient),
    }
  end

  def person(account)
    {
      id: account.id.to_s,
      acct: account.acct,
      name: account.display_name.presence || account.username,
      avatar: full_asset_url(account.avatar_static_url),
    }
  end
end
