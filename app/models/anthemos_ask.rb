# frozen_string_literal: true

# Something Kronk asks Anthemos on your phone to do (docs/spaces/map.md, Asks
# from Kronk): move your pin, share live location with a Mate, and later
# more. Kronk never reads the phone, so the website makes an ask and hands
# Anthemos only its token. Anthemos fetches it with its own sign-in, so an ask
# made in one account can never be carried out by a phone linked to another,
# shows it with Allow and Not now, and answers with the phone's signature. An
# ask lasts a few minutes and is answered once.
class AnthemosAsk < ApplicationRecord
  belongs_to :account
  belongs_to :anthemos_link, optional: true

  # Each kind and what it carries. A new kind is a line here, its check in
  # `payload_fits`, and a handler in Anthemos.
  PAYLOAD = {
    'location.update' => [],
    'location.share' => %w(to),
  }.freeze
  KINDS = PAYLOAD.keys.freeze
  ANSWERS = %w(done declined failed).freeze
  LIFETIME = 5.minutes
  # Old asks are swept when you make a new one; nothing needs them after.
  KEPT = 1.day

  validates :kind, inclusion: { in: KINDS }
  validate :payload_fits, on: :create

  before_validation :mint, on: :create

  # What the ask is now: waiting, done, declined, failed or expired.
  def state
    status == 'waiting' && expires_at <= Time.current ? 'expired' : status
  end

  def waiting?
    state == 'waiting'
  end

  # The Mate a share is for.
  def recipient
    Account.find_by(id: payload['to']) if kind == 'location.share'
  end

  def answer!(link:, outcome:, result:)
    update!(anthemos_link: link, status: outcome, result: result.to_s.strip.first(200).presence, answered_at: Time.current)
    link.touch(:last_used_at)
  end

  private

  def mint
    self.token ||= SecureRandom.urlsafe_base64(24)
    self.expires_at ||= LIFETIME.from_now
    self.payload = (payload || {}).slice(*PAYLOAD.fetch(kind, []))
  end

  def payload_fits
    return unless kind == 'location.share'

    to = payload['to'].to_s
    errors.add(:payload, :invalid) unless to.match?(/\A\d+\z/) && account.mates.exists?(id: to)
  end
end
