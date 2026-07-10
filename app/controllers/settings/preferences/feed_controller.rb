# frozen_string_literal: true

# Kronk feed preferences (§Feed) — user-controlled scope of what the
# home timeline pulls from, plus per-korner tune-in state. Persists via
# the standard UserSettings machinery.
class Settings::Preferences::FeedController < Settings::Preferences::BaseController
  def update
    apply_tune_in_toggles!
    super
  end

  private

  def after_update_redirect_path
    settings_preferences_feed_path
  end

  # Convert the per-korner checkbox map into KornerTuneOut writes.
  # 0/absent = tuned out (create row); 1 = tuned in (remove row).
  def apply_tune_in_toggles!
    return unless params[:korner_tune_ins].is_a?(ActionController::Parameters)

    params[:korner_tune_ins].to_unsafe_h.each do |slug, value|
      manifest = Kronk::KornerRegistry.find(slug)
      next unless manifest

      if value.to_s == '1'
        current_account.tune_in!(manifest.slug)
      else
        current_account.tune_out!(manifest.slug)
      end
    end
  end
end
