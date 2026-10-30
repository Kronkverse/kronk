# frozen_string_literal: true

# A Krew with its seeder as its first member.
Fabricator(:krew) do
  seeded_by { Fabricate(:account) }
  name { sequence(:krew_name) { |i| "Krew #{i}" } }
  slug { sequence(:krew_slug) { |i| "krew-#{i}" } }
  access 'open'
  invite_token { |attrs| attrs[:access] == 'open' ? nil : SecureRandom.urlsafe_base64(Krew::INVITE_TOKEN_BYTES) }
  last_activity_at { Time.current }
  after_create { |krew| krew.krew_memberships.create!(account: krew.seeded_by, role: 'seeder', source: 'direct') }
end
