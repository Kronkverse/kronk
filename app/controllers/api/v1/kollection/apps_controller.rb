# frozen_string_literal: true

# Kollection (docs/spaces/kollection.md): the apps linked to Kronk. Members
# only.
#
#   GET    /api/v1/kollection/apps                 every live app, A to Z,
#                                                  and any you keep that
#                                                  are pulled
#   GET    /api/v1/kollection/apps/:id             one app
#   POST   /api/v1/kollection/apps                 add one; you keep it
#   PATCH  /api/v1/kollection/apps/:id             its keeper or an admin
#   DELETE /api/v1/kollection/apps/:id             its keeper or an admin
#   POST   /api/v1/kollection/apps/:id/disconnect  revoke your own tokens
#                                                  for it, no one else's
#
# Params for create and update are Kollection::SaveApp's. Pulling and
# restoring an app, and naming its keeper, are the admin page's
# (Admin::KollectionAppsController).
class Api::V1::Kollection::AppsController < Api::BaseController
  include Authorization

  LIMIT = 200

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, except: [:index, :show]
  before_action :require_user!
  before_action :set_app, except: [:index, :create]

  def index
    apps = KollectionApp.shown_to(current_account)
                        .includes(:oauth_application, :icon_media_attachment, keeper: :user)
                        .order(Arel.sql('lower(kollection_apps.name)'), :id)
                        .limit(LIMIT)
                        .to_a

    render json: apps, each_serializer: REST::KollectionAppSerializer,
           viewer: current_account, connected_ids: KollectionApp.connected_application_ids(current_user, apps)
  end

  def show
    render_app
  end

  def create
    @app = KollectionApp.new(keeper: current_account)
    Kollection::SaveApp.new(@app, actor: current_account, params: app_params).call

    render_app
  end

  def update
    authorize @app, :manage?

    Kollection::SaveApp.new(@app, actor: current_account, params: app_params).call
    render_app
  end

  def destroy
    authorize @app, :manage?

    @app.remove!
    render_empty
  end

  def disconnect
    @app.disconnect!(current_user)
    render_app
  end

  private

  def set_app
    @app = KollectionApp.find(params[:id])
    # A pulled app is not there for anyone but its keeper and admins.
    raise ActiveRecord::RecordNotFound unless KollectionAppPolicy.new(current_account, @app).show?
  end

  def render_app
    @app.reload
    render json: @app, serializer: REST::KollectionAppSerializer,
           viewer: current_account, connected_ids: KollectionApp.connected_application_ids(current_user, [@app])
  end

  def app_params
    params.permit(:name, :description, :website, :sign_in, :redirect_uris, :icon_id, redirect_uris: [], scopes: [])
  end
end
