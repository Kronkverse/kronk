# frozen_string_literal: true

# Read/write helpers for the account's tune-in state per korner.
# Implicit default: absence of a KornerTuneOut row = tuned in. See §N.5.
module Account::KornerTuneIn
  extend ActiveSupport::Concern

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
end
