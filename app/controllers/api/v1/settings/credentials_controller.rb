# frozen_string_literal: true

# Sign-in credentials — email + password. Kronk-native replacement
# for the Devise `/auth/edit` page (Tal 2026-09-13: "the email should
# be changable from settings/account, not needing a following page").
#
#   GET  /api/v1/settings/credentials => { email, unconfirmed_email }
#   PUT  /api/v1/settings/credentials  body: {
#     current_password:       required,
#     email:                  optional new email — sets `unconfirmed_email`
#                             + sends confirmation link (Devise::Confirmable)
#     password:               optional new password
#     password_confirmation:  required alongside password
#   }
#
# Password change wipes all OTHER web sessions (mirrors what Devise's
# RegistrationsController does via `clear_other_sessions`) so a leaked
# device is booted. The current SPA session is preserved when the
# caller has one (cookie-authed API request); pure API tokens end up
# clearing everything — safer than leaving stale sessions alive.
class Api::V1::Settings::CredentialsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  def show
    render json: payload
  end

  def update
    unless current_user.valid_password?(params[:current_password].to_s)
      render json: { error: 'incorrect_current_password' }, status: 422
      return
    end

    updates = {}

    new_email = params[:email].to_s.strip
    updates[:email] = new_email if new_email.present? && new_email != current_user.email

    if params[:password].present?
      updates[:password]              = params[:password]
      updates[:password_confirmation] = params[:password_confirmation]
    end

    if updates.empty?
      render json: { error: 'no_changes' }, status: 422
      return
    end

    begin
      current_user.update!(updates)
    rescue ActiveRecord::RecordInvalid => e
      render json: ValidationErrorFormatter.new(e).as_json, status: 422
      return
    end

    # Boot other browsers on password change. `.exclusive(nil)` still
    # works (destroys everything) if the API caller isn't cookie-authed.
    current_user.clear_other_sessions(session[:session_id]) if updates.key?(:password)

    render json: payload
  end

  private

  def payload
    {
      email: current_user.email,
      unconfirmed_email: current_user.unconfirmed_email,
    }
  end
end
