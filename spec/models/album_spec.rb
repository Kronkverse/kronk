# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Album do
  let(:owner)    { Fabricate(:account) }
  let(:krew)     { Krew.create!(slug: 'squad', name: 'Squad', access: 'open') }
  let(:member)   { Fabricate(:account) }
  let(:stranger) { Fabricate(:account) }

  before { krew.krew_memberships.create!(account: member) }

  def album(visibility, with_krew: false)
    a = described_class.create!(owner: owner, title: 'Trip', visibility: visibility)
    a.album_krews.create!(krew_id: krew.id) if with_krew
    a
  end

  describe 'krew as an orthogonal audience axis' do
    it 'is no longer a visibility value' do
      expect(described_class.visibilities).to_not have_key('krew')
    end

    it 'is valid as a self_only album with no krews' do
      expect(described_class.new(owner: owner, title: 'X', visibility: :self_only)).to be_valid
    end

    it 'shows a self_only + krew album to a member of that krew (additive)' do
      expect(album(:self_only, with_krew: true).visible_to?(member)).to be true
    end

    it 'hides a self_only + krew album from a non-member' do
      expect(album(:self_only, with_krew: true).visible_to?(stranger)).to be false
    end

    it 'shows a mates album to a krew member who is not a mate (additive)' do
      expect(album(:mates, with_krew: true).visible_to?(member)).to be true
    end

    it 'includes krew-targeted albums in visible_to regardless of reach' do
      a = album(:self_only, with_krew: true)
      expect(described_class.visible_to(member)).to include(a)
    end
  end
end
