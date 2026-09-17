# frozen_string_literal: true

require 'rails_helper'
require 'mastodon/cli/cache'

RSpec.describe Mastodon::CLI::Cache do
  subject { cli.invoke(action, arguments, options) }

  let(:cli) { described_class.new }
  let(:arguments) { [] }
  let(:options) { {} }

  it_behaves_like 'CLI Command'

  describe '#clear' do
    let(:action) { :clear }

    before { allow(Rails.cache).to receive(:clear) }

    it 'clears the Rails cache' do
      expect { subject }
        .to output_results('OK')
      expect(Rails.cache).to have_received(:clear)
    end
  end

  describe '#recount' do
    let(:action) { :recount }

    context 'with the `accounts` argument' do
      let(:arguments) { ['accounts'] }
      let(:account_stat) { Fabricate(:account_stat) }

      before do
        account_stat.update(statuses_count: 123)
      end

      it 're-calculates account records in the cache' do
        expect { subject }
          .to output_results('OK')

        expect(account_stat.reload.statuses_count).to be_zero
      end

      # Kronk — `mates_count` is a denormalised counter maintained by
      # Follow callbacks, so it drifts like the Mastodon three and has to
      # be repaired by the same command. It was added to the counters
      # concern without being added to the recount, which left a repair
      # run silently fixing three counters out of four.
      context 'with a drifted mates_count' do
        let(:account) { account_stat.account }
        let(:mate)    { Fabricate(:account) }

        before do
          account.follow!(mate)
          mate.follow!(account)
          account_stat.update(mates_count: 99)
        end

        it 're-counts mutual follows' do
          expect { subject }
            .to output_results('OK')

          expect(account_stat.reload.mates_count).to eq(1)
        end
      end
    end

    context 'with the `statuses` argument' do
      let(:arguments) { ['statuses'] }
      let(:status_stat) { Fabricate(:status_stat) }

      before do
        status_stat.update(replies_count: 123)
      end

      it 're-calculates account records in the cache' do
        expect { subject }
          .to output_results('OK')

        expect(status_stat.reload.replies_count).to be_zero
      end
    end

    context 'with an unknown type' do
      let(:arguments) { ['other-type'] }

      it 'Exits with an error message' do
        expect { subject }
          .to raise_error(Thor::Error, /Unknown/)
      end
    end
  end
end
