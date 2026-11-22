# frozen_string_literal: true

require 'rails_helper'

RSpec.describe REST::Nudges::MessageSerializer do
  subject { serialized_record_json(message, described_class, options: { scope: author, scope_name: :current_user }) }

  let(:author) { Fabricate(:account) }
  let(:conversation) { Fabricate(:nudges_conversation, one: author, two: Fabricate(:account)) }
  let(:message) do
    Fabricate(:nudges_conversation_message, conversation: conversation, author_account: author,
                                            body: '', media_attachment_ids: [attachment.id])
  end

  def media
    subject['media'].first
  end

  context 'with a photo' do
    let(:attachment) { Fabricate(:media_attachment, account: author, type: :image) }

    it 'previews it with the small still and gives full urls' do
      expect(media).to include(
        'type' => 'image',
        'url' => start_with('http').and(include('/original/')),
        'preview_url' => start_with('http').and(include('/small/')),
        'processing' => false
      )
    end
  end

  # A sound picked from "File" came back with the mp3 as its preview,
  # which the chat drew as a broken picture.
  context 'with a sound' do
    let(:attachment) do
      Fabricate(:media_attachment, account: author, type: :audio,
                                   file: attachment_fixture('boop.mp3'))
    end

    it 'has no picture preview, only the file' do
      expect(media).to include('type' => 'audio', 'url' => include('.mp3'), 'preview_url' => nil)
    end
  end

  # A video sent before it's been processed pointed at a file that
  # wasn't there yet.
  context 'with a video still being processed' do
    let(:attachment) do
      Fabricate(:media_attachment, account: author, type: :video).tap do |m|
        m.update_column(:processing, MediaAttachment.processings[:queued])
      end
    end

    it 'gives no urls yet and says it is on its way' do
      expect(media).to include('url' => nil, 'preview_url' => nil, 'processing' => true)
    end
  end

  context 'with a file that failed to process' do
    let(:attachment) do
      Fabricate(:media_attachment, account: author, type: :image).tap do |m|
        m.update_column(:processing, MediaAttachment.processings[:failed])
      end
    end

    it 'gives no urls and is not on its way' do
      expect(media).to include('url' => nil, 'processing' => false)
    end
  end
end
