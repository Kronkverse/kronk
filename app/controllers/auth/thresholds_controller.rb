# frozen_string_literal: true

# The threshold ceremony — three concentric rings around Ж, one vow
# per ring, crossed in order. See KRONK_SIGNUP.md §4 for the flow
# and §6 for the canonical vow copy.
#
# Crossing state is client-side and session-scoped until the single
# POST from the arrival panel. If a member abandons the page they
# start again at the first threshold on return; there is no partial
# credit, no back button between rings, no un-cross.
#
# The HTML gate that redirects here (for a signed-in user who hasn't
# crossed at the current version) lives in
# ApplicationController#require_crossed_thresholds! — wired up in a
# later layer. API/OAuth paths deliberately stay open.
class Auth::ThresholdsController < ApplicationController
  layout 'kronk_void'

  before_action :authenticate_user!

  # Skip the require_functional! chain — a member reaches the ceremony
  # via a redirect from that same chain (once wired). Letting it re-fire
  # would loop.
  skip_before_action :require_functional!

  def show
    redirect_to(root_path) && return if current_user.crossed_thresholds?
  end

  def create
    unless Kronk::Thresholds::KEYS.all? { |key| ActiveModel::Type::Boolean.new.cast(params[key]) }
      # Missing any vow → re-render the first threshold. Do not partially
      # credit; the ceremony is atomic. The `alert` key is added by
      # layer 4 (locale file).
      redirect_to(auth_thresholds_path, alert: I18n.t('kronk.thresholds.errors.incomplete')) && return
    end

    current_user.record_thresholds_crossing!
    redirect_to root_path
  end
end
