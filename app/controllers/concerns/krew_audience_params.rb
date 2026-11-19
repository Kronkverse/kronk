# frozen_string_literal: true

# The Krews and people a film, kar, kronikle, art piece or listing is for,
# as its composer's reach control sends them, top level, the same names a
# post takes.
#
# `krew_ids` (Kronk::KrewAudience): only Krews the poster is in are taken.
# On update the list replaces the set (an empty list removes every Krew),
# except for Krews the poster has since left: the form can't offer those,
# so an edit leaves them rather than dropping them by omission.
#
# `audience_grant_ids` / `audience_exclude_ids` (Kronk::PeopleAudience):
# people let in and kept out. Either one sent replaces both; neither sent
# leaves them, unless the record is now Kronkverse, which carries none.
module KrewAudienceParams
  extend ActiveSupport::Concern

  PEOPLE_KEYS = %i(audience_grant_ids audience_exclude_ids).freeze

  private

  def sync_record_audience!(record)
    sync_krew_audience!(record)
    sync_people_audience!(record)
  end

  def sync_krew_audience!(record)
    return unless params.key?(:krew_ids)

    own = KrewMembership.where(account_id: current_account.id).pluck(:krew_id)
    wanted = Array(params[:krew_ids]).map(&:to_i).reject(&:zero?).uniq & own
    kept = record.record_krews.pluck(:krew_id) - own
    record.sync_audience_krews!(wanted + kept)
  end

  def sync_people_audience!(record)
    if PEOPLE_KEYS.any? { |key| params.key?(key) }
      record.sync_audience_people!(added: params[:audience_grant_ids], removed: params[:audience_exclude_ids])
    elsif record.record_people.exists?
      # Kept as they were; sync drops them all if the record went Kronkverse.
      record.sync_audience_people!(added: record.audience_added_ids, removed: record.audience_removed_ids)
    end
  end
end
