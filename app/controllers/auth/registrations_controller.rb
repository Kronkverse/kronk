# frozen_string_literal: true

class Auth::RegistrationsController < Devise::RegistrationsController
  include RegistrationHelper
  include Auth::RegistrationSpamConcern

  layout :determine_layout

  before_action :set_invite, only: [:new, :create]
  before_action :check_enabled_registrations, only: [:new, :create]
  before_action :configure_sign_up_params, only: [:create]
  before_action :set_sessions, only: [:edit, :update]
  before_action :set_strikes, only: [:edit, :update]
  before_action :require_not_suspended!, only: [:update]
  before_action :set_rules, only: :new
  # Four-step signup — the gates render their step in order. Whichever
  # returns first short-circuits the chain, so a visitor walks:
  # welcome → rules → privacy → details. See app/views/auth/registrations.
  #
  # `handle_rewind!` runs FIRST so a Back link like
  # `?rewind=<step>` can clear the sticky session flags before the
  # gates check them — otherwise the gate chain would advance right
  # past the step the user is trying to revisit.
  before_action :handle_rewind!, only: :new
  before_action :require_welcome_seen!, only: :new
  before_action :require_rules_acceptance!, only: :new
  before_action :require_privacy_acceptance!, only: :new
  before_action :set_registration_form_time, only: :new

  skip_before_action :check_self_destruct!, only: [:edit, :update]
  skip_before_action :require_functional!, only: [:edit, :update]

  def new
    super(&:build_invite_request)
  end

  def edit
    super
  end

  def create
    super
  end

  def update
    super do |resource|
      resource.clear_other_sessions(current_session.session_id) if resource.saved_change_to_encrypted_password?
    end
  end

  def destroy
    not_found
  end

  protected

  def update_resource(resource, params)
    params[:password] = nil if Devise.pam_authentication && resource.encrypted_password.blank?

    super
  end

  def build_resource(hash = nil)
    super

    resource.locale                 = I18n.locale
    resource.invite_code            = @invite&.code if resource.invite_code.blank?
    resource.registration_form_time = session[:registration_form_time]
    resource.sign_up_ip             = request.remote_ip

    resource.build_account if resource.account.nil?

    # Kronk defaults for freshly-signed-up local accounts (Phase 11.4).
    # Sign-ups get follower approval on by default. Applied here rather
    # than as a model-level callback so internal + fabricator-created
    # accounts (test seeds, staff bots, service accounts) keep the
    # framework default of unlocked.
    resource.account.locked = true if resource.account && !resource.account.locked
  end

  def configure_sign_up_params
    devise_parameter_sanitizer.permit(:sign_up) do |user_params|
      user_params.permit({ account_attributes: [:username, :display_name], invite_request_attributes: [:text] }, :email, :password, :password_confirmation, :invite_code, :agreement, :website, :confirm_password, :date_of_birth)
    end
  end

  def after_sign_up_path_for(_resource)
    # Email confirmation was retired as a gate (see User#functional_or_moved?
    # — the `confirmed?` clause is gone). A fresh signup lands straight in
    # the SPA; the Kronk system nudger surfaces "confirm your email" as a
    # persistent reminder rather than a wall. `/auth/setup` still exists as
    # a resend / change-email surface the reminder can deep-link to.
    root_path
  end

  def after_sign_in_path_for(_resource)
    set_invite

    if @invite.present?
      short_account_path(@invite.user.account)
    else
      super
    end
  end

  def after_inactive_sign_up_path_for(_resource)
    new_user_session_path
  end

  def after_update_path_for(_resource)
    edit_user_registration_path
  end

  def check_enabled_registrations
    redirect_to new_user_session_path, alert: I18n.t('devise.failure.closed_registrations', email: Setting.site_contact_email) unless allowed_registration?(request.remote_ip, @invite)
  end

  def invite_code
    if params[:user]
      params[:user][:invite_code]
    else
      params[:invite_code]
    end
  end

  private

  def set_invite
    @invite = begin
      invite = Invite.find_by(code: invite_code) if invite_code.present?
      invite if invite&.valid_for_use?
    end
  end

  def determine_layout
    %w(edit update).include?(action_name) ? 'admin' : 'auth'
  end

  def set_sessions
    @sessions = current_user.session_activations.order(updated_at: :desc)
  end

  def set_strikes
    @strikes = current_account.strikes.recent.latest
  end

  def require_not_suspended!
    forbidden if current_account.unavailable?
  end

  def set_rules
    @rules = Rule.ordered.includes(:translations)
  end

  # Back-navigation for the four-step signup. Each step's Back link
  # points at `/auth/sign_up?rewind=<step>`. This action clears the
  # sticky session flag for that step AND every downstream flag —
  # you're re-considering, so we make you walk forward through the
  # subsequent steps again. Without this, the gate chain would race
  # past the step the user is trying to revisit (sticky flags always
  # win, which is exactly what makes Back-nav within the flow work).
  def handle_rewind!
    case params[:rewind]
    when 'welcome'
      session.delete(:welcome_seen)
      session.delete(:welcome_token)
      session.delete(:rules_accepted)
      session.delete(:accept_token)
      session.delete(:privacy_accepted)
      session.delete(:privacy_token)
    when 'rules'
      session.delete(:rules_accepted)
      session.delete(:accept_token)
      session.delete(:privacy_accepted)
      session.delete(:privacy_token)
    when 'privacy'
      session.delete(:privacy_accepted)
      session.delete(:privacy_token)
    end
  end

  # Step 1: welcome. Explains what Kronk is before we ask for anything.
  # The `?welcomed=<token>` link on the welcome page round-trips a
  # per-visit token; on match we flip a *sticky* session flag so
  # Back-navigating from a later step doesn't re-render the welcome
  # copy for the same visitor.
  def require_welcome_seen!
    return if session[:welcome_seen]

    if session[:welcome_token].present? && params[:welcomed] == session[:welcome_token]
      session[:welcome_seen] = true
      return
    end

    @welcome_token = session[:welcome_token] = SecureRandom.hex
    @invite_code   = invite_code

    set_locale { render :welcome }
  end

  # Step 2: server rules. Token-on-URL, sticky-flag-on-match. Existing
  # gate — same pattern, now with the sticky flag so a Back-nav from
  # privacy/details doesn't force the user through the rules screen
  # again.
  def require_rules_acceptance!
    return if @rules.empty? || session[:rules_accepted]

    if session[:accept_token].present? && params[:accept] == session[:accept_token]
      session[:rules_accepted] = true
      return
    end

    @accept_token = session[:accept_token] = SecureRandom.hex
    @invite_code  = invite_code

    set_locale { render :rules }
  end

  # Step 3: privacy key-points. Same pattern with an independent token
  # so accepting one gate can't inadvertently pass the other. Sets a
  # hidden `agreement: '1'` on the details form so Devise's built-in
  # validator is satisfied downstream — the acceptance itself is
  # recorded here, not on the details page.
  def require_privacy_acceptance!
    return if session[:privacy_accepted]

    if session[:privacy_token].present? && params[:privacy_accepted] == session[:privacy_token]
      session[:privacy_accepted] = true
      return
    end

    @privacy_token = session[:privacy_token] = SecureRandom.hex
    @invite_code   = invite_code

    set_locale { render :privacy }
  end

  def is_flashing_format? # rubocop:disable Naming/PredicatePrefix
    if params[:action] == 'create'
      false # Disable flash messages for sign-up
    else
      super
    end
  end
end
