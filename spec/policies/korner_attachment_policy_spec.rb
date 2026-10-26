# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KornerAttachmentPolicy do
  subject { described_class }

  let(:owner)    { Fabricate(:account) }
  let(:stranger) { Fabricate(:account) }
  let(:event)    { Event.create!(account: owner, title: 'Launch', start_time: 2.days.from_now, end_time: 2.days.from_now + 2.hours) }

  before { Kronk::KornerRegistry.reload! }

  def link_to(album)
    KornerAttachment.new(source_slug: 'kalendar', source_id: event.id, target_slug: 'albutts', target_id: album.id, kind: 'link', created_by_account: owner)
  end

  permissions :create? do
    it 'lets whoever looks after the source link it to a record they can see' do
      album = Album.create!(owner: stranger, title: 'Open album', visibility: :public)
      expect(subject).to permit(owner, link_to(album))
    end

    it "refuses a target they can't see, even owning the source" do
      album = Album.create!(owner: stranger, title: 'Private album', visibility: :self_only)
      expect(subject).to_not permit(owner, link_to(album))
    end

    it 'refuses someone who does not look after the source' do
      album = Album.create!(owner: stranger, title: 'Open album', visibility: :public)
      expect(subject).to_not permit(stranger, link_to(album))
    end
  end
end
