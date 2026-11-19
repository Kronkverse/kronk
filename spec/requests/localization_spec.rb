# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Localization' do
  around do |example|
    I18n.with_locale(I18n.locale) do
      example.run
    end
  end

  it 'uses a specific region when provided' do
    headers = { 'Accept-Language' => 'zh-HK' }

    get '/auth/sign_in', headers: headers

    expect(response.body).to include(
      I18n.t('auth.login', locale: 'zh-HK')
    )
  end

  it 'falls back to a locale when region missing' do
    headers = { 'Accept-Language' => 'es-FAKE' }

    get '/auth/sign_in', headers: headers

    expect(response.body).to include(
      I18n.t('auth.login', locale: 'es')
    )
  end

  it 'falls back to english when locale is missing' do
    headers = { 'Accept-Language' => '12-FAKE' }

    get '/auth/sign_in', headers: headers

    expect(response.body).to include(
      I18n.t('auth.login', locale: 'en')
    )
  end

  # Kronk: British English gets Kronk's English, not
  # Mastodon's en-GB translation (docs/decisions.md, 2026-11-19).
  it 'serves Kronk English to a browser asking for British English' do
    get '/auth/sign_in', headers: { 'Accept-Language' => 'en-GB,en;q=0.9' }

    expect(response.body).to include("<html lang='en'>")
  end

  it 'serves Kronk English to a browser asking for Australian English' do
    get '/auth/sign_in', headers: { 'Accept-Language' => 'en-AU' }

    expect(response.body).to include("<html lang='en'>")
  end
end
