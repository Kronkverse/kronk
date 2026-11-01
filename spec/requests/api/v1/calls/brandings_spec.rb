# frozen_string_literal: true

require 'rails_helper'

# Jitsi's own words for a Booth live set, fetched by the Jitsi server's page
# (docs/spaces/booth.md, Live sets, The words).
RSpec.describe 'API V1 Calls Branding' do
  it 'gives a live set’s room its own words, with no sign-in', :aggregate_failures do
    get '/api/v1/calls/branding', params: { conferenceFqn: "shadow-booth-#{'a1' * 10}" }

    expect(response).to have_http_status(200)
    expect(response.parsed_body.dig('labels', 'en', 'prejoin', 'joinMeeting')).to eq 'Into the booth'
    expect(response.parsed_body.dig('labels', 'enGB', 'notify', 'connectedOneMember')).to eq '{{name}} is listening'
  end

  it 'reads the room from a tenant path' do
    get '/api/v1/calls/branding', params: { conferenceFqn: "kronk/booth-#{'0f' * 10}" }

    expect(response.parsed_body).to have_key('labels')
  end

  it 'leaves the Huddle and Kuddles with Jitsi’s own words', :aggregate_failures do
    %w(huddle shadow-huddle coworking-1a2b3c4d booth-1a2b3c4d).each do |room|
      get '/api/v1/calls/branding', params: { conferenceFqn: room }

      expect(response.parsed_body).to eq({})
    end
  end
end
