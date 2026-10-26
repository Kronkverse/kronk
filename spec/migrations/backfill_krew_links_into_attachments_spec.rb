# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20261022140000_backfill_krew_links_into_attachments.rb')

# Events and albums already in a Krew's audience get the link that now
# goes with it, so both ends show it in their Attached blocks.
RSpec.describe BackfillKrewLinksIntoAttachments do
  def run!
    migration = described_class.new
    migration.suppress_messages { migration.up }
  end

  let(:account) { Fabricate(:account) }
  let(:krew)    { Krew.create!(slug: 'gardeners', name: 'Gardeners', access: 'open') }
  let(:status)  { Fabricate(:status, account: account) }
  let!(:event)  { Event.create!(account: account, title: 'Working bee', status: status, start_time: 2.days.from_now) }
  let(:album)   { Album.create!(owner: account, title: 'Seed swap', visibility: :self_only) }

  def links(slug, id)
    Kronk::AttachmentEffects.between(slug, id, 'krew', krew.id)
  end

  it "links an event whose post has the Krew in its audience, made by the event's owner" do
    Kronk::StatusKrews.add(status.id, krew.id)

    run!

    expect(links('kalendar', event.id).pluck(:source_slug, :created_by_account_id)).to eq([['kalendar', account.id]])
  end

  it "links an album in the Krew's audience" do
    AlbumKrew.insert_all([{ album_id: album.id, krew_id: krew.id }])

    run!

    expect(links('albutts', album.id).pluck(:source_slug, :created_by_account_id)).to eq([['albutts', account.id]])
  end

  it 'leaves a pair already linked from the Krew end alone' do
    Kronk::StatusKrews.add(status.id, krew.id)
    KornerAttachment.create!(source_slug: 'krew', source_id: krew.id, target_slug: 'kalendar', target_id: event.id, kind: 'link', created_by_account: account)

    run!

    expect(links('kalendar', event.id).count).to eq 1
  end

  it 'leaves a post that is not an event alone, and is safe to run twice' do
    Kronk::StatusKrews.add(Fabricate(:status, account: account).id, krew.id)
    Kronk::StatusKrews.add(status.id, krew.id)

    expect { run! }.to change(KornerAttachment, :count).by(1)
    expect { run! }.to_not change(KornerAttachment, :count)
  end
end
