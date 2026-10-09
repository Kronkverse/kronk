# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Media' do
  describe 'GET /media/:id' do
    context 'when the media attachment does not exist' do
      it 'responds with not found' do
        get '/media/missing'

        expect(response)
          .to have_http_status(404)
      end
    end

    context 'when the media attachment has a shortcode' do
      let(:media_attachment) { Fabricate :media_attachment, status: status, shortcode: 'OI6IgDzG-nYTqvDQ994' }

      context 'when attached to a status' do
        let(:status) { Fabricate :status }

        it 'redirects to file url' do
          get medium_path(id: media_attachment.shortcode)

          expect(response)
            .to redirect_to(media_attachment.file.url(:original))
        end
      end

      context 'when not attached to a status' do
        let(:status) { nil }

        it 'responds with not found' do
          get medium_path(id: media_attachment.shortcode)

          expect(response)
            .to have_http_status(404)
        end
      end

      context 'when attached to non-public status' do
        let(:status) { Fabricate :status, visibility: :direct }

        it 'responds with not found' do
          get medium_path(id: media_attachment.shortcode)

          expect(response)
            .to have_http_status(404)
        end
      end
    end

    context 'when the media attachment does not have a shortcode' do
      let(:media_attachment) { Fabricate :media_attachment, status: status, shortcode: nil }

      context 'when attached to a status' do
        let(:status) { Fabricate :status }

        it 'redirects to file url' do
          get medium_path(id: media_attachment.id)

          expect(response)
            .to redirect_to(media_attachment.file.url(:original))
        end
      end

      context 'when not attached to a status' do
        let(:status) { nil }

        it 'responds with not found' do
          get medium_path(id: media_attachment.id)

          expect(response)
            .to have_http_status(404)
        end
      end

      context 'when attached to non-public status' do
        let(:status) { Fabricate :status, visibility: :direct }

        it 'responds with not found' do
          get medium_path(id: media_attachment.id)

          expect(response)
            .to have_http_status(404)
        end
      end
    end
  end

  describe 'GET /media/:id/download' do
    let(:media_attachment) { Fabricate :media_attachment, status: status }

    context 'when attached to a visible status' do
      let(:status) { Fabricate :status }

      it 'sends the original as an attachment named after Kronk and the media id' do
        get medium_download_path(media_attachment)

        expect(response).to have_http_status(200)
        expect(response.headers['Content-Disposition'])
          .to start_with('attachment')
          .and include("kronk-#{media_attachment.id}.")
      end

      context 'when the file lives in object storage' do
        let(:s3_object) { double(presigned_url: 'https://bucket.example/signed') }

        before do
          # The test env stores files on disk, so the S3 adapter's
          # `s3_object` doesn't exist to verify against.
          without_partial_double_verification do
            allow_any_instance_of(Paperclip::Attachment).to receive(:s3_object).and_return(s3_object) # rubocop:disable RSpec/AnyInstance
          end
        end

        it 'redirects to a short-lived signed URL that forces a download' do
          get medium_download_path(media_attachment)

          expect(response).to redirect_to('https://bucket.example/signed')
          expect(s3_object).to have_received(:presigned_url).with(
            :get,
            expires_in: 300,
            response_content_disposition: a_string_starting_with('attachment').and(including("kronk-#{media_attachment.id}."))
          )
        end
      end
    end

    context 'when attached to a status the viewer cannot see' do
      let(:status) { Fabricate :status, visibility: :direct }

      it 'responds with not found' do
        get medium_download_path(media_attachment)

        expect(response).to have_http_status(404)
      end
    end

    context 'when not attached to a status' do
      let(:status) { nil }

      it 'responds with not found' do
        get medium_download_path(media_attachment)

        expect(response).to have_http_status(404)
      end
    end
  end
end
