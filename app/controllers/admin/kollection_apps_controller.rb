# frozen_string_literal: true

# Kollection's apps, for admins (docs/spaces/kollection.md). Any member can
# add an app and it goes live at once; here an admin pulls one that
# shouldn't be there (it leaves the list, its tokens are revoked and it can
# no longer sign anyone in), restores it, or names its keeper (when the old
# one's account is gone, say). Gated on `manage_settings`; why is in
# KollectionAppPolicy.
module Admin
  class KollectionAppsController < BaseController
    before_action :set_app, except: :index

    def index
      authorize :kollection_app, :index?

      @apps = KollectionApp.includes(:oauth_application, keeper: :user).order(:status, Arel.sql('lower(kollection_apps.name)'), :id)
    end

    def pull
      authorize @app, :admin?

      @app.pull!
      redirect_to admin_kollection_apps_path, notice: t('kollection.admin.pulled', name: @app.name)
    end

    def restore
      authorize @app, :admin?

      @app.restore!
      redirect_to admin_kollection_apps_path, notice: t('kollection.admin.restored', name: @app.name)
    end

    def keeper
      authorize @app, :admin?

      username = params[:username].to_s.strip.delete_prefix('@')
      if username.blank?
        @app.update!(keeper: nil)
        return redirect_to admin_kollection_apps_path, notice: t('kollection.admin.keeper_cleared', name: @app.name)
      end

      account = Account.find_local(username)
      if account.nil? || account.unavailable? || account.user.nil?
        redirect_to admin_kollection_apps_path, alert: t('kollection.admin.keeper_not_found', username: username)
      else
        @app.update!(keeper: account)
        redirect_to admin_kollection_apps_path, notice: t('kollection.admin.keeper_set', name: @app.name, username: account.username)
      end
    end

    private

    def set_app
      @app = KollectionApp.find(params[:id])
    end
  end
end
