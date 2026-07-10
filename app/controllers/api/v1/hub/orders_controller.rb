# frozen_string_literal: true

# Read/write the current user's custom Hub grid ordering.
#
#   GET  /api/v1/hub/order    → { order: [slug, slug, ...] }
#                               empty array when the user is on defaults
#   PUT  /api/v1/hub/order    payload: { order: [slug, slug, ...] }
#                               replaces the account's ordering wholesale;
#                               unknown or duplicate slugs are rejected.
#   DEL  /api/v1/hub/order    reset back to the default order
class Api::V1::Hub::OrdersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: :show
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update, :destroy]
  before_action :require_user!

  def show
    render json: { order: ordered_slugs_for(current_account) }
  end

  def update
    slugs = Array(params[:order]).map(&:to_s)

    return render json: { error: 'order must contain distinct known slugs' }, status: 422 unless valid?(slugs)

    ActiveRecord::Base.transaction do
      current_account.user_hub_orders.delete_all
      slugs.each_with_index do |slug, i|
        current_account.user_hub_orders.create!(korner_slug: slug, position: i)
      end
    end

    render json: { order: ordered_slugs_for(current_account) }
  end

  def destroy
    current_account.user_hub_orders.delete_all
    render json: { order: [] }
  end

  private

  def ordered_slugs_for(account)
    account.user_hub_orders.order(:position).pluck(:korner_slug)
  end

  def valid?(slugs)
    return false if slugs.empty? || slugs.size != slugs.uniq.size

    known = Kronk::KornerRegistry.all.map(&:slug).to_set
    slugs.all? { |s| known.include?(s) }
  end
end
