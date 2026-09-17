# frozen_string_literal: true

class Api::V1::Accounts::RelationshipsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!

  def index
    # `profile_visibility` is needed by REST::RelationshipSerializer#profile_visible
    # (it reads Account#profile_visible_to?); without it the minimal select
    # raised ActiveModel::MissingAttributeError → 500 on every relationship
    # fetch (which left Mate buttons spinning forever).
    @accounts = Account.where(id: account_ids).select(:id, :domain, :profile_visibility)
    @accounts.merge!(Account.without_suspended) unless truthy_param?(:with_suspended)
    render json: @accounts, each_serializer: REST::RelationshipSerializer, relationships: relationships
  end

  private

  def relationships
    AccountRelationshipsPresenter.new(@accounts, current_user.account_id)
  end

  def account_ids
    Array(params[:id]).map(&:to_i)
  end
end
