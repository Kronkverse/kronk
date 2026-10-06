# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Auth Setup' do
  context 'with an unconfirmed signed in user' do
    let(:user) { Fabricate(:user, confirmed_at: nil) }

    before { sign_in(user) }

    it 'can update email address' do
      visit auth_setup_path

      expect(page)
        .to have_content(I18n.t('auth.setup.title'))

      # Kronk's setup page keeps the change-email form in a plain <details>.
      find('details summary').click
      fill_in 'user_email', with: 'new-email@example.host'

      expect { submit_form }
        .to(change { user.reload.unconfirmed_email })
      expect(page)
        .to have_content(I18n.t('auth.setup.new_confirmation_instructions_sent'))
    end

    def submit_form
      find('[name=button]').click
    end
  end
end
