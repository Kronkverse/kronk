# frozen_string_literal: true

require 'rails_helper'

# A post that only backs something a space owns has nothing of its own to
# show, so notifications and the post page send people to Status#kronk_page.
# A froth on a Moment once opened an empty post page (Tal 2026-10-15). Every
# type in KRONK_BACKING_POST_TYPES needs a page, and a builder here.
RSpec.describe Status, '#kronk_page' do
  let(:owner) { Fabricate(:account) }

  def backing(type, text: 'x')
    Fabricate(:status, account: owner, text: text, post_type: type)
  end

  builders = {
    'moment' => lambda {
      status = backing(:moment, text: '')
      moment = Moment.create!(account: owner, media_attachment: Fabricate(:media_attachment, account: owner), visibility: :public)
      moment.update!(status: status)
      [status, "/hub/moments/#{moment.id}"]
    },
    'album_photo' => lambda {
      album = Album.create!(owner: owner, title: 'Trip')
      status = backing(:album_photo)
      photo = AlbumPhoto.create!(album: album, contributor: owner, status: status)
      [status, "/hub/albutts/albums/#{album.id}?photo=#{photo.id}"]
    },
    'answer' => lambda {
      question = Question.create!(created_by_account: Fabricate(:account), title: 'Q?')
      status = backing(:answer)
      Answer.create!(question: question, account: owner, body: 'A', status: status)
      [status, "/hub/kuestions/answered?k=#{question.id}"]
    },
  }

  it 'has a builder here for every backing post type' do
    expect(builders.keys).to match_array(described_class::KRONK_BACKING_POST_TYPES),
                             'a new backing post type needs a page in Status#kronk_page and a builder in this spec'
  end

  described_class::KRONK_BACKING_POST_TYPES.each do |type|
    it "sends a #{type} post to its page" do
      status, page = instance_exec(&builders.fetch(type))

      expect(status.reload.kronk_page).to eq(page)
    end
  end

  it 'has none for a post that shows on its own' do
    expect(Fabricate(:status, account: owner).kronk_page).to be_nil
  end

  it 'is serialised only when there is one' do
    status, page = instance_exec(&builders.fetch('moment'))
    plain = Fabricate(:status, account: owner)

    json = ->(s) { ActiveModelSerializers::SerializableResource.new(s, serializer: REST::StatusSerializer, scope: nil, scope_name: :current_user).as_json }

    expect(json.call(status.reload)).to include(kronk_page: page)
    expect(json.call(plain)).to_not have_key(:kronk_page)
  end
end
