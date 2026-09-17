# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Credentials' do
  let(:user)    { Fabricate(:user, email: 'old@example.com', password: 'oldpassword123') }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/credentials' do
    let(:scopes) { 'read:accounts' }

    it 'returns the current email and pending unconfirmed_email' do
      get '/api/v1/settings/credentials', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq(
        'email' => 'old@example.com',
        'unconfirmed_email' => nil
      )
    end
  end

  describe 'PUT /api/v1/settings/credentials' do
    let(:scopes) { 'write:accounts' }

    it 'rejects an incorrect current password' do
      put '/api/v1/settings/credentials',
          headers: headers,
          params: { current_password: 'wrong', email: 'new@example.com' }

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to eq('incorrect_current_password')
      expect(user.reload.email).to eq('old@example.com')
      expect(user.unconfirmed_email).to be_nil
    end

    # The assertion is about the job, not the mailbox. Devise notifications
    # go out through User#send_devise_notification, which defers them past
    # the transaction and sends with `deliver_later` — so nothing lands in
    # ActionMailer::Base.deliveries during a request spec, and asserting on
    # it fails whether or not the confirmation was queued. It failed from
    # the moment this spec was written (#1834). Same shape as
    # user_spec.rb's `#send_confirmation_instructions`, including swapping
    # the queue adapter for the examples that need it. Name the mail rather
    # than counting jobs: changing an email queues two, because Devise also
    # tells the old address that the address changed.
    context 'when changing the email' do
      around do |example|
        queue_adapter = ActiveJob::Base.queue_adapter
        ActiveJob::Base.queue_adapter = :test
        example.run
        ActiveJob::Base.queue_adapter = queue_adapter
      end

      it 'sets unconfirmed_email + queues confirmation on new email' do
        expect do
          put '/api/v1/settings/credentials',
              headers: headers,
              params: { current_password: 'oldpassword123', email: 'new@example.com' }
        end.to have_enqueued_mail(UserMailer, :confirmation_instructions)

        expect(response).to have_http_status(200)
        user.reload
        # Devise::Confirmable holds the change in `unconfirmed_email`
        # until the user clicks the confirmation link.
        expect(user.email).to eq('old@example.com')
        expect(user.unconfirmed_email).to eq('new@example.com')
        expect(response.parsed_body).to eq(
          'email' => 'old@example.com',
          'unconfirmed_email' => 'new@example.com'
        )
      end
    end

    it 'changes password when password + confirmation match' do
      put '/api/v1/settings/credentials',
          headers: headers,
          params: {
            current_password: 'oldpassword123',
            password: 'newpassword456',
            password_confirmation: 'newpassword456',
          }

      expect(response).to have_http_status(200)
      user.reload
      expect(user.valid_password?('newpassword456')).to be true
      expect(user.valid_password?('oldpassword123')).to be false
    end

    it 'rejects mismatched password + confirmation' do
      put '/api/v1/settings/credentials',
          headers: headers,
          params: {
            current_password: 'oldpassword123',
            password: 'newpassword456',
            password_confirmation: 'different',
          }

      expect(response).to have_http_status(422)
      expect(user.reload.valid_password?('oldpassword123')).to be true
    end

    it 'refuses a request with no changes' do
      put '/api/v1/settings/credentials',
          headers: headers,
          params: { current_password: 'oldpassword123' }

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to eq('no_changes')
    end

    it 'clears other web sessions on password change' do
      other = Fabricate(:session_activation, user: user, session_id: 'other-browser')
      Fabricate(:session_activation, user: user, session_id: 'yet-another')

      put '/api/v1/settings/credentials',
          headers: headers,
          params: {
            current_password: 'oldpassword123',
            password: 'newpassword456',
            password_confirmation: 'newpassword456',
          }

      # API caller has no cookie-based session; the current session
      # falls back to nil, so every SessionActivation gets wiped.
      expect(user.session_activations.reload).to be_empty
      expect { other.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
