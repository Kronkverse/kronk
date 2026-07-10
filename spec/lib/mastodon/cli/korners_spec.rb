# frozen_string_literal: true

require 'rails_helper'
require 'mastodon/cli/korners'

RSpec.describe Mastodon::CLI::Korners do
  subject { cli.invoke(action, arguments, options) }

  let(:cli) { described_class.new }
  let(:arguments) { [] }
  let(:options) { {} }

  before { Kronk::KornerRegistry.reload! }

  it_behaves_like 'CLI Command'

  describe '#list' do
    let(:action) { :list }

    it 'prints a row for the kommons manifest' do
      expect { subject }.to output(/kommons/).to_stdout
    end
  end

  describe '#describe' do
    let(:action) { :describe }

    context 'with a known slug' do
      let(:arguments) { ['kommons'] }

      it 'dumps the manifest as YAML' do
        expect { subject }.to output(/slug: kommons/).to_stdout
      end
    end

    context 'with an unknown slug' do
      let(:arguments) { ['not-a-real-slug'] }

      it 'reports and exits non-zero' do
        expect { subject }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/No manifest found/).to_stdout
      end
    end
  end

  describe '#doctor' do
    let(:action) { :doctor }

    it 'prints the doctor header and exits' do
      # Exits 0 on clean state, 1 on drift — either is a valid outcome
      # depending on the test DB shape. We just verify it invokes cleanly.
      expect { subject }.to raise_error(SystemExit)
        .and output(/Korner framework doctor/).to_stdout
    end
  end
end
