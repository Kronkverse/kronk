# frozen_string_literal: true

Fabricator(:user) do
  account do |attrs|
    Fabricate.build(
      :account,
      attrs.fetch(:account_attributes, {}).merge(user: nil)
    )
  end
  email        { sequence(:email) { |i| "#{i}#{Faker::Internet.email}" } }
  password     '123456789'
  confirmed_at { Time.zone.now }
  current_sign_in_at { Time.zone.now }
  agreement true

  # Default fabricated users to "already crossed the thresholds" so
  # the `require_crossed_thresholds!` gate in ApplicationController
  # doesn't redirect every controller-spec request to /auth/thresholds.
  # The threshold ceremony itself has its own specs that opt out via
  # `thresholds_version { nil }`.
  thresholds_agreed_at { Time.zone.now }
  thresholds_version   { Kronk::Thresholds::CURRENT_VERSION }
end

Fabricator(:admin_user, from: :user) do
  role UserRole.find_by(name: 'Admin')
end

Fabricator(:moderator_user, from: :user) do
  role UserRole.find_by(name: 'Moderator')
end

Fabricator(:owner_user, from: :user) do
  role UserRole.find_by(name: 'Owner')
end
