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
    # Unified signup: the form POST carries account fields + avatar
    # + three threshold acknowledgements
    # (`user[thresholds][ownership|custodianship|trajectory]`). All
    # three must be truthy — no crossing state, no signup. Enforced
    # BEFORE Devise's create runs so we don't create a User only to
    # find them un-crossed.
    unless thresholds_all_acknowledged?
      flash.now[:alert] = I18n.t('kronk.thresholds.errors.incomplete')
      self.resource = resource_class.new(sign_up_params)
      # Plain `render`, not `respond_with(resource) { render ... }`. The
      # block renders the form back, and then the responder runs its own
      # `default_render` on the way out — two renders in one action, so
      # Rails raises `AbstractController::DoubleRenderError` and the
      # visitor gets a 500. Anyone who submitted the signup form without
      # ticking all three vows hit that instead of being handed the form
      # back with the message above.
      render :new, status: :unprocessable_entity
      return
    end

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

    # Threshold crossing is atomic with account creation — the form
    # POST includes the three vow acknowledgements as a single
    # `user[thresholds]` hash. If the guard in `#create` didn't 422,
    # they're all acknowledged; stamp the crossing here so it lands
    # in the same DB transaction as the User + Account create. Legacy
    # members who signed up before this (no thresholds_version) still
    # go through `Auth::ThresholdsController` for their re-cross.
    if thresholds_all_acknowledged?
      resource.thresholds_agreed_at = Time.now.utc
      resource.thresholds_version   = Kronk::Thresholds::CURRENT_VERSION
    end
  end

  def configure_sign_up_params
    # Threshold acknowledgements (`user[thresholds][KEY]`) are NOT
    # part of the User's assignable attributes — they're read from
    # raw params in `#create` and `#build_resource`. Keeping them
    # out of the sanitized set means Devise's `User.new(sign_up_params)`
    # doesn't try to assign a `thresholds=` that doesn't exist on
    # the model.
    devise_parameter_sanitizer.permit(:sign_up) do |user_params|
      user_params.permit({ account_attributes: [:username, :display_name, :avatar], invite_request_attributes: [:text] }, :email, :password, :invite_code, :agreement, :website, :confirm_password, :date_of_birth)
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

  # True iff the form POST carries a truthy acknowledgement for each
  # of the three canonical thresholds. Values come in as '1' / '0'
  # strings from the hidden inputs the ceremony JS flips as the
  # member crosses each ring; parse via ActiveModel's boolean caster
  # for consistency with the standalone ThresholdsController.
  def thresholds_all_acknowledged?
    return false unless params.dig(:user, :thresholds).is_a?(ActionController::Parameters)

    Kronk::Thresholds::KEYS.all? do |key|
      ActiveModel::Type::Boolean.new.cast(params[:user][:thresholds][key])
    end
  end

  def set_invite
    @invite = begin
      invite = Invite.find_by(code: invite_code) if invite_code.present?
      invite if invite&.valid_for_use?
    end
  end

  def determine_layout
    case action_name
    when 'edit', 'update'
      'admin'
    when 'new', 'create'
      'kronk_void'
    else
      'auth'
    end
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

  def is_flashing_format? # rubocop:disable Naming/PredicatePrefix
    if params[:action] == 'create'
      false # Disable flash messages for sign-up
    else
      super
    end
  end
end
