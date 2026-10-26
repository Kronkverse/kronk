# frozen_string_literal: true

# The Krews a film, kar, kronikle, art piece or listing is for, as its
# composer's reach control sends them: `krew_ids`, top level, the same as an
# album's (Kronk::KrewAudience). Only Krews the poster is in are taken. On
# update the list replaces the set (an empty list removes every Krew),
# except for Krews the poster has since left: the form can't offer those,
# so an edit leaves them rather than dropping them by omission.
module KrewAudienceParams
  extend ActiveSupport::Concern

  private

  def sync_krew_audience!(record)
    return unless params.key?(:krew_ids)

    own = KrewMembership.where(account_id: current_account.id).pluck(:krew_id)
    wanted = Array(params[:krew_ids]).map(&:to_i).reject(&:zero?).uniq & own
    kept = record.record_krews.pluck(:krew_id) - own
    record.sync_audience_krews!(wanted + kept)
  end
end
