# frozen_string_literal: true

module InvitesHelper
  def invites_max_uses_options
    [1, 5, 10, 25, 50, 100]
  end

  def invites_expires_options
    [30.minutes, 1.hour, 6.hours, 12.hours, 1.day, 1.week]
  end

  # Inline SVG QR code for `url` at a comfortable scan size (module size
  # 6, quiet zone 4). Rendered server-side via rqrcode so the page has
  # no JS dependency and the QR is copy-drag-savable straight from the
  # DOM. The SVG payload is generated locally from a URL string built
  # from the invite code (a whitelisted alphabet, no user markup) so
  # marking it html_safe is safe.
  def invite_qr_svg(url)
    svg = RQRCode::QRCode.new(url).as_svg(
      module_size: 6,
      color: '111111',
      shape_rendering: 'crispEdges',
      standalone: true,
      use_path: true
    )
    # Strip the XML prolog — legal in HTML5 but confuses some sniffers
    # and clutters the DOM. The wrapping <svg> element is what we need.
    svg.sub(/\A<\?xml[^>]*\?>/, '').html_safe # rubocop:disable Rails/OutputSafety
  end
end
