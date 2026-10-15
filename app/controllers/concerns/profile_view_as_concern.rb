# frozen_string_literal: true

# "See it as others do" on your own profile (docs/spaces/profile.md, Who can
# see a profile). The owner passes `as=kronkverse|orbit|mates` to the
# endpoints a profile is read from, and they answer as they would for a
# member in that circle, rather than with everything the owner may see.
#
# Only the owner can ask, and only about their own profile; to anyone else
# `as` is ignored. It reads the same reach scopes the real checks do, so the
# preview cannot drift from what people actually get.
module ProfileViewAsConcern
  extend ActiveSupport::Concern

  # Status reach each circle sees, on top of the profile-content scopes in
  # ProfileVisibility::AUDIENCE_SCOPES. `private` is the Mastodon-era
  # followers-only reach, which on Kronk means Mates.
  STATUS_VISIBILITIES = {
    'kronkverse' => %w(public unlisted),
    'orbit' => %w(public unlisted orbit),
    'mates' => %w(public unlisted orbit mates private),
  }.freeze

  private

  # The circle the owner asked to see their profile as, or nil.
  def profile_view_as(owner)
    audience = params[:as].to_s
    return unless ProfileVisibility::AUDIENCE_SCOPES.key?(audience)
    return unless current_account && owner && current_account.id == owner.id

    audience
  end
end
