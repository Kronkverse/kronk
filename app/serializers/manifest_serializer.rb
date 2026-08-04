# frozen_string_literal: true

class ManifestSerializer < ActiveModel::Serializer
  include InstanceHelper
  include RoutingHelper
  include ActionView::Helpers::TextHelper

  attributes :id, :name, :short_name,
             :icons, :theme_color, :background_color,
             :display, :start_url, :scope,
             :share_target, :shortcuts,
             :prefer_related_applications, :related_applications

  def id
    # This is set to `/home` because that was the old value of `start_url` and
    # thus the fallback ID computed by Chrome:
    # https://developer.chrome.com/blog/pwa-manifest-id/
    '/home'
  end

  def name
    object.title
  end

  def short_name
    object.title
  end

  def icons
    # The android-chrome icons are transparent, edge-to-edge Ж glyphs
    # (`purpose: 'any'`). A launcher that masks them would clip the
    # glyph. For maskable rendering, expose the two dedicated
    # `icon-{192,512}-maskable.png` variants — opaque, with an 80%
    # safe circle around the mark.
    any = SiteUpload::ANDROID_ICON_SIZES.map do |size|
      src = app_icon_path(size.to_i)
      src = URI.join(root_url, src).to_s if src.present?

      {
        src: src || frontend_asset_url("icons/android-chrome-#{size}x#{size}.png"),
        sizes: "#{size}x#{size}",
        type: 'image/png',
        purpose: 'any',
      }
    end
    maskable = [192, 512].map do |size|
      {
        src: frontend_asset_url("icons/icon-#{size}-maskable.png"),
        sizes: "#{size}x#{size}",
        type: 'image/png',
        purpose: 'maskable',
      }
    end
    any + maskable
  end

  def theme_color
    '#191b22'
  end

  def background_color
    '#191b22'
  end

  def display
    'standalone'
  end

  def start_url
    '/'
  end

  def scope
    '/'
  end

  def share_target
    {
      url_template: 'share?title={title}&text={text}&url={url}',
      action: 'share',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    }
  end

  def shortcuts
    [
      {
        name: 'Compose new post',
        url: '/publish',
      },
      {
        name: 'Notifications',
        url: '/notifications',
      },
      {
        name: 'Explore',
        url: '/explore',
      },
    ]
  end

  # Disabled to promote PWA installation instead of native apps
  def prefer_related_applications
    false
  end

  # No related applications - we want users to use our PWA
  def related_applications
    []
  end
end
