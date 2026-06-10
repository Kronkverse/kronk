# Kronk Spaces

A space is a distinct area of the Kronk platform with its own route, identity, and community context. This document covers what's needed to build a new space so it aligns with existing ones.

---

## Post preview card

When a link to a space is posted on Kronk, it should render a branded preview card — purple `#563ACC` background, white Tinos serif wordmark, 1200×630px.

### 1. Register the space in `SpacePreviewController`

Add an entry to the `SPACES` hash in `app/controllers/space_preview_controller.rb`:

```ruby
'market' => {
  name: 'Ӎarket',
  wordmark: 'ӍARKET',
  tagline: 'One-line description of the space.',
},
```

The wordmark should use the same unicode character that appears in the sidebar name, uppercased.

### 2. Add the route

In `config/routes.rb`:

```ruby
get '/market', to: 'market#index'
```

### 3. Create the controller

`app/controllers/market_controller.rb` — do not add `authenticate_user!`, bots need to crawl this page to generate the preview card:

```ruby
# frozen_string_literal: true

class MarketController < ApplicationController
  include WebAppControllerConcern

  def index
    expires_in(15.seconds, public: true, stale_while_revalidate: 30.seconds, stale_if_error: 1.day) unless user_signed_in?
  end
end
```

### 4. Add OG meta tags to the view

`app/views/market/index.html.haml`:

```haml
- content_for :header_tags do
  = opengraph 'og:site_name', site_title
  = opengraph 'og:url', "#{root_url.chomp('/')}#{request.path}"
  = opengraph 'og:type', 'website'
  = opengraph 'og:title', 'Ӎarket'
  = opengraph 'og:description', 'One-line description of the space.'
  = opengraph 'og:image', "#{root_url.chomp('/')}/market-preview.png"
  = opengraph 'og:image:width', '1200'
  = opengraph 'og:image:height', '630'
  = opengraph 'twitter:card', 'summary_large_image'

= render 'shared/web_app'
```

### 5. Allow local link cards

Add the path to `ALLOWED_LOCAL_PATHS` in `app/services/fetch_link_card_service.rb`:

```ruby
ALLOWED_LOCAL_PATHS = %w(/kalendar /governance /huddle /home /market).freeze
```

### 6. Generate and commit the preview image

Deploy to staging, then run:

```js
// /tmp/take-space-screenshots.mjs
import puppeteer from '/tmp/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
await page.goto('https://shadow.kronk.info/space-preview/market', {
  waitUntil: 'networkidle0',
  timeout: 30000,
});
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: '/home/claude/kronk/public/market-preview.png' });
await browser.close();
```

```bash
node /tmp/take-space-screenshots.mjs
```

Commit `public/market-preview.png` to the branch.
