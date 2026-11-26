# frozen_string_literal: true

require 'rails_helper'

# No border crossovers on a phone. Every page of the app is opened at a
# phone's width and nothing may stick out past the box it sits in: a card
# past its panel, a panel past the screen, a row of choices past its card.
# A side-scrolling row is allowed (its container scrolls), and so is
# anything absolutely placed (badges, menus, toasts). See docs/design.md
# (Frame, Phones: nothing crosses its container's edge).
#
# The pages are read from the app's own route table and the korner
# registry, so a new page is covered without adding it here. A page that
# needs an id (a post, an event) isn't covered; check those by eye.
RSpec.describe 'Phone crossovers', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  # Dev-only or one-time pages, not part of the app a member uses.
  let(:skipped) { %w(/styleguide /keyboard-shortcuts /nudges/legacy /start /start/profile /setup /publish) }

  # For each element in normal flow: how far it sticks out of its parent's
  # inner box. Only the outermost crossing of a chain is reported.
  def crossovers_js
    <<~JS
      (() => {
        const name = (el) => {
          const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2) : [];
          return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
        };
        const crossing = new Set();
        const found = [];
        for (const el of document.body.querySelectorAll('*')) {
          const parent = el.parentElement;
          if (!parent || parent === document.body) continue;
          const style = getComputedStyle(el);
          if (['fixed', 'absolute'].includes(style.position) || style.visibility === 'hidden') continue;
          // Toasts slide in from off-screen.
          if (el.closest('.notification-list')) continue;
          // Inside an <svg>, drawing is clipped to the svg, but a shape's box
          // ignores clip paths: Inflow's moon shadow is a disc slid off the
          // moon by the day's phase, so near full moon its box sits ~70px out.
          if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
          const box = el.getBoundingClientRect();
          if (box.width <= 1 || box.height <= 1) continue;
          if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) continue;
          const outer = parent.getBoundingClientRect();
          if (outer.width <= 1) continue;
          const ps = getComputedStyle(parent);
          const over = Math.max(
            box.right - (outer.right - parseFloat(ps.borderRightWidth)),
            (outer.left + parseFloat(ps.borderLeftWidth)) - box.left,
          );
          if (over <= 2) continue;
          crossing.add(el);
          if (crossing.has(parent)) continue;
          found.push(`${name(parent)} > ${name(el)} by ${Math.round(over)}px`);
        }
        return found;
      })()
    JS
  end

  def app_routes
    table = Rails.root.join('app', 'javascript', 'mastodon', 'features', 'ui', 'index.jsx').read
    paths = table.scan(/path=(?:\{\[([^\]]*)\]\}|'([^']*)'|"([^"]*)")/).flat_map { |list, single, double| (list || single || double).scan(%r{/[^'",\s]*}) }
    Kronk::KornerRegistry.all.each do |korner| # rubocop:disable Rails/FindEach -- a plain array, not a relation
      paths << korner.mount_path
      paths << "#{korner.mount_path}/settings" if korner.settings.present? && korner.mount_path.to_s.start_with?('/hub/')
    end
    paths << '/@bob'
    paths.compact.uniq.reject { |path| path.include?(':') || skipped.include?(path) }.sort
  end

  it 'has nothing past its container at 390px wide' do
    ignore_js_error(/./)
    as_a_logged_in_user
    page.current_window.resize_to(390, 844)

    routes = app_routes
    expect(routes.size).to be > 50

    crossings = routes.each_with_object({}) do |route, found|
      visit route
      sleep 1.5
      result = page.evaluate_script(crossovers_js)
      found[route] = result if result.any?
    end

    expect(crossings).to be_empty, -> { "Crossing their container at phone width:\n#{crossings.map { |route, list| "  #{route}\n#{list.first(5).map { |line| "    #{line}" }.join("\n")}" }.join("\n")}" }
  end
end
