# frozen_string_literal: true

# Identity content card on an account's /@user profile.
#
# Cards are the per-user "About me / Interests / Values / …" surfaces
# shown on the sectioned profile Me tab. They hold identity content —
# not statuses. (Post collections live on ProfileSection.)
#
# Every card carries a per-card visibility scope so a user can share
# some identity content publicly and keep other cards private:
#
#   everyone     the fediverse — no gate
#   kronk        only accounts on the same instance
#   connections  only mutual follows
#   vouched      Anthemos-verified tier 2+ — falls back to `connections`
#                until the membrane ships
#   only_me      draft / soft-hide — only the owner sees it
class ProfileCard < ApplicationRecord
  # Card types recognised by the frontend. Adding a new one here does
  # NOT automatically render it — the `profile_shelves` composer
  # decides which types the Library exposes and how each renders.
  # This list is validated to prevent arbitrary strings, so the
  # frontend has a bounded set to switch on.
  CARD_TYPES = %w(
    about
    interests
    exploring
    personality
    drive
    rotation
    moments
    values
    note
    highlights
    at_a_glance
    open_to
    where_i_am
    pod_credentials
  ).freeze

  # The three told-shape renders the composer offers.
  #
  #   block  — free-form paragraph (default). Uses `body` as-is.
  #   chips  — a list of short tag-style strings. Body is comma or
  #            newline separated; the client tokenises client-side.
  #   rail   — a horizontal rail of mini-cards, each `heading — text`.
  #            Body carries the whole rail as newline-separated pairs;
  #            the client parses. Keeping it in `body` avoids a schema
  #            branch per shape — every render still reads/writes one
  #            text field.
  #
  # New shapes can land in a pure-frontend PR — the backend accepts
  # any value here so long as it's on this list.
  RENDER_SHAPES = %w(block chips rail).freeze

  belongs_to :account, inverse_of: :profile_cards

  enum :visibility, {
    everyone: 0,
    kronk: 1,
    connections: 2,
    vouched: 3,
    only_me: 4,
  }, prefix: true

  validates :card_type, presence: true, inclusion: { in: CARD_TYPES },
                        uniqueness: { scope: :account_id }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :body, length: { maximum: 4000 }
  validates :render, inclusion: { in: RENDER_SHAPES }

  scope :ordered, -> { order(:position) }
  scope :shown,   -> { where(visible: true) }

  # Filter — is this card visible to the given viewer account? viewer
  # may be nil (unauthenticated / logged-out fediverse visitor).
  def visible_to?(viewer)
    return true if visibility_everyone?

    # Owner always sees everything they've written.
    return true if viewer && viewer.id == account_id

    case visibility
    when 'kronk'
      viewer&.local? && account.local?
    when 'connections'
      viewer && mutual_follow?(viewer)
    when 'vouched' # rubocop:disable Lint/DuplicateBranch
      # Vouched requires Anthemos. Until the membrane ships, fall back
      # to the connections gate — a slightly narrower audience than the
      # designed behaviour but never leaks content wider than intended.
      viewer && mutual_follow?(viewer)
    else # only_me — already handled by the owner check above
      false
    end
  end

  private

  def mutual_follow?(viewer)
    Follow.exists?(account_id: account_id, target_account_id: viewer.id) &&
      Follow.exists?(account_id: viewer.id, target_account_id: account_id)
  end
end
