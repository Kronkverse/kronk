# frozen_string_literal: true

# Open to collab (docs/spaces/booth.md, Open to collab): a musician's own
# Booth setting, `open_to_collab` in their Booth settings. Saying yes is an
# invitation: anyone in the Booth may message them about making something
# together, Mates or not, the way a shop invites enquiries. Saying no (the
# default) leaves Nudges' Mates-only rule as it is.
module BoothCollab
  KORNER = 'booth'
  SETTING = 'open_to_collab'

  # The ids, of `account_ids`, of people open to collab. One query.
  def self.open_account_ids(account_ids)
    ids = Array(account_ids).compact.uniq
    return Set.new if ids.empty?

    UserKornerSetting.joins(:user)
                     .where(korner_slug: KORNER, users: { account_id: ids })
                     .where("user_korner_settings.values ->> '#{SETTING}' = 'true'")
                     .pluck('users.account_id')
                     .to_set
  end

  def self.open?(account)
    account.present? && open_account_ids([account.id]).include?(account.id)
  end

  # Whether `sender` may start a chat with `artist` because the artist is
  # open to collab: never themselves, never across a block either way.
  def self.messageable?(artist, sender:)
    return false if artist.nil? || sender.nil? || artist.id == sender.id
    return false if artist.blocking?(sender) || sender.blocking?(artist)

    open?(artist)
  end
end
