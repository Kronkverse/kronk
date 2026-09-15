# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Rose::SendService do
  let(:sender)    { Fabricate(:account) }
  let(:recipient) { Fabricate(:account) }

  def make_mates(one, other)
    one.follow!(other)
    other.follow!(one)
  end

  describe '#call' do
    context 'when the two are Mates' do
      before { make_mates(sender, recipient) }

      it 'creates a rose for the current Kronk day' do
        rose = described_class.new(sender, recipient).call

        expect(rose).to be_persisted
        expect(rose.sent_on).to eq Rose.current_day
        expect(Rose.today_for(recipient)).to eq [rose]
      end

      it 'refuses a second rose to the same person on the same day' do
        described_class.new(sender, recipient).call

        expect { described_class.new(sender, recipient).call }
          .to raise_error(described_class::AlreadySentError)
      end

      it 'allows a rose again once the day has rolled over' do
        travel_to Time.utc(2026, 9, 15, 1, 0) do
          described_class.new(sender, recipient).call
        end

        travel_to Time.utc(2026, 9, 16, 1, 0) do
          expect { described_class.new(sender, recipient).call }.to change(Rose, :count).by(1)
        end
      end
    end

    context 'when they are not Mates' do
      it 'refuses a one-way follow' do
        sender.follow!(recipient)

        expect { described_class.new(sender, recipient).call }
          .to raise_error(described_class::NotMatesError)
      end

      it 'refuses a stranger' do
        expect { described_class.new(sender, recipient).call }
          .to raise_error(described_class::NotMatesError)
      end

      it 'refuses a rose to yourself' do
        expect { described_class.new(sender, sender).call }
          .to raise_error(described_class::NotMatesError)
      end
    end
  end
end
