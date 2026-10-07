# frozen_string_literal: true

class Auth::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  include AccountSwitching

  skip_before_action :check_self_destruct!
  skip_before_action :verify_authenticity_token

  def self.provides_callback_for(provider)
    define_method provider do
      @provider = provider

      # "Add account" from the switcher. Upstream hands find_for_omniauth the
      # signed-in user, which links whatever identity comes back to THAT
      # account: picking a second kronk.info account would have attached it
      # to the first, permanently, and signed the first back in. When adding,
      # look the identity up on its own instead, and keep the current account
      # in the switcher.
      adding = user_signed_in? && request.env['omniauth.params']&.dig('add').present?
      @user = User.find_for_omniauth(request.env['omniauth.auth'], adding ? nil : current_user)

      if @user.persisted? && adding
        record_login_activity
        add_to_switcher(@user)
        set_flash_message(:notice, :success, kind: label_for_provider) if is_navigational_format?
        redirect_to after_sign_in_path_for(@user)
      elsif @user.persisted?
        record_login_activity
        sign_in_and_redirect @user, event: :authentication
        set_flash_message(:notice, :success, kind: label_for_provider) if is_navigational_format?
      else
        session["devise.#{provider}_data"] = request.env['omniauth.auth']
        redirect_to new_user_registration_url
      end
    rescue ActiveRecord::RecordInvalid
      flash[:alert] = I18n.t('devise.failure.omniauth_user_creation_failure') if is_navigational_format?
      redirect_to new_user_session_url
    end
  end

  Devise.omniauth_configs.each_key do |provider|
    provides_callback_for provider
  end

  def after_sign_in_path_for(resource)
    if resource.email_present?
      stored_location_for(resource) || root_path
    else
      auth_setup_path(missing_email: '1')
    end
  end

  private

  # Same steps as Auth::SessionsController's add-account path: keep the
  # current account's activation alive for switching back, rotate the session
  # id, sign the new account in and record both in the switcher set.
  def add_to_switcher(user)
    preserved = authed_accounts.merge(current_user.id.to_s => cookies.signed['_session_id'])
    stored_location = stored_location_for(:user)

    cookies.delete('_session_id')
    sign_out(current_user)
    reset_session
    store_location_for(:user, stored_location) if stored_location

    user.update_sign_in!(new_sign_in: true)
    sign_in(user)
    record_authed_account(user, cookies.signed['_session_id'], prior: preserved)
  end

  def record_login_activity
    @user.login_activities.create(
      success: true,
      authentication_method: :omniauth,
      provider: @provider,
      ip: request.remote_ip,
      user_agent: request.user_agent
    )
  end

  def label_for_provider
    provider_display_name || configured_provider_name
  end

  def provider_display_name
    Devise.omniauth_configs[@provider]&.strategy&.display_name.presence
  end

  def configured_provider_name
    I18n.t("auth.providers.#{@provider}", default: @provider.to_s.chomp('_oauth2').capitalize)
  end
end
