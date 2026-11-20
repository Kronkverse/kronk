# frozen_string_literal: true

# Kronk — Mateship. What you and one Mate share: when you became Mates,
# Mates in common, and the Krews, events and projekts you're both in.
#
#   GET /api/v1/accounts/:account_id/mateship
#
# Only the two Mates can read it: anyone else gets 404, as if there were
# nothing there (decisions.md, 2026-11-19). Mates::MateshipService does the
# work; this shapes it.
class Api::V1::Accounts::MateshipsController < Api::BaseController
  include RoutingHelper

  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!
  before_action :set_account

  def show
    mateship = Mates::MateshipService.new.call(current_account, @account)
    return render(json: { error: 'Record not found' }, status: 404) if mateship.nil?

    render json: {
      since: mateship[:since]&.iso8601,
      matuals_count: mateship[:matuals_count],
      matuals: mateship[:matuals].map { |account| account_preview(account) },
      krews: mateship[:krews].map { |krew| krew_preview(krew) },
      events: mateship[:events].map { |event| event_preview(event) },
      projekts: mateship[:projekts].map { |projekt| projekt_preview(projekt) },
    }
  end

  private

  def set_account
    @account = Account.find(params[:account_id])
  end

  def account_preview(account)
    {
      id: account.id.to_s,
      acct: account.acct,
      display_name: account.display_name.presence || account.username,
      avatar: full_asset_url(account.avatar_static_url),
    }
  end

  def krew_preview(krew)
    {
      id: krew.id.to_s,
      slug: krew.slug,
      name: krew.name,
      member_count: krew.member_count,
      image_url: krew.image? ? full_asset_url(krew.image.url(:original)) : nil,
    }
  end

  def event_preview(event)
    {
      id: event.id.to_s,
      slug: event.slug,
      title: event.title,
      start_time: event.start_time.iso8601,
      location_name: event.location_name,
      image_url: event.image&.file&.url(:small),
    }
  end

  def projekt_preview(projekt)
    {
      id: projekt.id.to_s,
      title: projekt.title,
      # Projekt pages live under their Krew (docs/spaces/freethedream.md).
      krew_slug: projekt.krew&.slug,
      cover_url: projekt.cover&.file&.url(:small),
    }
  end
end
