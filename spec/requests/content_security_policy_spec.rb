# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Content-Security-Policy' do
  before { allow(SecureRandom).to receive(:base64).with(16).and_return('ZbA+JmE7+bK8F5qvADZHuQ==') }

  # `form-action 'self'`, not `'none'`. Signed out, `/` renders the landing,
  # which carries a real HTML sign-in form posting to `/auth/sign_in` —
  # `HomeController` widens the policy for exactly that. The SPA itself still
  # submits nothing (every POST is fetch/XHR), so this doesn't loosen anything
  # the app relied on being shut.
  it 'sets the expected CSP headers' do
    get '/'

    expect(response_csp_headers)
      .to match_array(expected_csp_headers)
  end

  def response_csp_headers
    response
      .headers['Content-Security-Policy']
      .split(';')
      .map(&:strip)
  end

  def expected_csp_headers
    <<~CSP.split("\n").map(&:strip)
      base-uri 'none'
      child-src 'self' blob: #{local_domain}
      connect-src 'self' data: blob: #{local_domain} #{Rails.configuration.x.streaming_api_base_url} https://meet.talitamoss.info #{map_tile_host}
      default-src 'none'
      font-src 'self' #{local_domain}
      form-action 'self'
      frame-ancestors 'none'
      frame-src 'self' https:
      img-src 'self' data: blob: #{local_domain} #{map_tile_host}
      manifest-src 'self' #{local_domain}
      media-src 'self' data: #{local_domain}
      script-src 'self' #{local_domain} 'wasm-unsafe-eval' https://meet.talitamoss.info
      style-src 'self' #{local_domain} 'nonce-ZbA+JmE7+bK8F5qvADZHuQ=='
      worker-src 'self' blob: #{local_domain}
    CSP
  end

  def local_domain
    root_url(host: Rails.configuration.x.local_domain).chop
  end

  def map_tile_host
    ENV.fetch('MAP_TILE_HOST', 'https://kronk-osm.syd1.digitaloceanspaces.com')
  end
end
