# frozen_string_literal: true

# Read/write helpers for the account's tune-in state per korner.
# Implicit default: absence of a KornerTuneOut row = tuned in. See §N.5.
# A korner whose manifest says `feed_projection.tuned_in_by_default: false`
# (Kommons) gets its row when a local account is created, so it is opt-in.
module Account::KornerTuneIn
  extend ActiveSupport::Concern

  included do
    after_create :tune_out_of_opt_in_korners, if: :local?
  end

  def tuned_in_to?(slug)
    !korner_tune_outs.exists?(korner_slug: slug.to_s)
  end

  def tuned_in_korner_slugs
    tuned_out = korner_tune_outs.pluck(:korner_slug).to_set
    Kronk::KornerRegistry.all.map(&:slug).reject { |s| tuned_out.include?(s) }
  end

  def tune_out!(slug)
    korner_tune_outs.find_or_create_by!(korner_slug: slug.to_s) do |row|
      row.tuned_out_at = Time.current
    end
  end

  def tune_in!(slug)
    korner_tune_outs.where(korner_slug: slug.to_s).delete_all
  end

  private

  def tune_out_of_opt_in_korners
    opt_in = Kronk::KornerRegistry.all.reject { |m| m.core? || m.tuned_in_by_default? }
    opt_in.each { |manifest| tune_out!(manifest.slug) }
  end
end
