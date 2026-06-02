# frozen_string_literal: true

class NatureObservationGenerator
  REDIS_KEY_PREFIX = 'in_flow:observation'
  TTL = 48.hours.to_i
  LAT = -37.8136
  LON = 144.9631
  INATURALIST_PLACE_ID = 6744 # Victoria, Australia

  WEATHER_CODES = {
    0 => 'clear sky',
    1 => 'mainly clear',
    2 => 'partly cloudy',
    3 => 'overcast',
    45 => 'foggy',
    48 => 'foggy with frost',
    51 => 'light drizzle',
    53 => 'drizzle',
    55 => 'heavy drizzle',
    61 => 'light rain',
    63 => 'rain',
    65 => 'heavy rain',
    71 => 'light snow',
    73 => 'snow',
    80 => 'rain showers',
    81 => 'rain showers',
    82 => 'heavy rain showers',
    85 => 'snow showers',
    95 => 'thunderstorm',
    96 => 'thunderstorm with hail',
    99 => 'thunderstorm with hail',
  }.freeze

  EARTH_CALENDAR = {
    0 => { season: 'late summer',  bloom: %w(Agapanthus Sunflower Bougainvillea Frangipani) },
    1 => { season: 'late summer',  bloom: %w(Waterlily Agapanthus) + ['Crepe myrtle'] },
    2 => { season: 'early autumn', bloom: ['Autumn crocus', 'Salvia', 'Cyclamen'] },
    3 => { season: 'autumn',       bloom: %w(Camellia Clivia Banksia) },
    4 => { season: 'late autumn',  bloom: %w(Camellia Grevillea Protea) },
    5 => { season: 'winter',       bloom: %w(Wattle Camellia Jonquil) },
    6 => { season: 'winter',       bloom: %w(Wattle Magnolia Daphne) },
    7 => { season: 'late winter',  bloom: %w(Wattle Grevillea Jonquil) + ['Native orchid'] },
    8 => { season: 'early spring', bloom: %w(Jasmine Wisteria Boronia) + ['Cherry blossom'] },
    9 => { season: 'spring',       bloom: %w(Boronia Grevillea Hardenbergia) + ['Flannel flower'] },
    10 => { season: 'late spring',  bloom: %w(Jacaranda Frangipani Agapanthus) },
    11 => { season: 'early summer', bloom: %w(Agapanthus Bougainvillea Frangipani Waterlily) },
  }.freeze

  def self.fetch_or_enqueue(date)
    cached = fetch(date)
    return cached if cached

    NatureObservationWorker.perform_async(date.to_s)
    nil
  end

  def self.fetch(date)
    redis_key = "#{REDIS_KEY_PREFIX}:#{date}"
    Rails.cache.redis.get(redis_key)
  rescue
    nil
  end

  def self.generate!(date)
    weather   = fetch_weather(date)
    sightings = fetch_recent_sightings(date)
    prompt    = build_prompt(date, weather, sightings)
    text      = call_claude(prompt)

    if text.present?
      redis_key = "#{REDIS_KEY_PREFIX}:#{date}"
      Rails.cache.redis.setex(redis_key, TTL, text)
    end

    text
  rescue => e
    Rails.logger.error("NatureObservationGenerator failed: #{e.message}")
    nil
  end

  def self.fetch_weather(date)
    conn = Faraday.new('https://api.open-meteo.com')
    response = conn.get('/v1/forecast', {
      latitude: LAT,
      longitude: LON,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
      timezone: 'Australia/Melbourne',
      start_date: date.to_s,
      end_date: date.to_s,
    })

    data = JSON.parse(response.body)
    daily = data['daily']
    return {} unless daily

    code   = daily['weather_code']&.first&.to_i
    t_max  = daily['temperature_2m_max']&.first&.to_f
    t_min  = daily['temperature_2m_min']&.first&.to_f
    precip = daily['precipitation_sum']&.first&.to_f

    {
      condition: WEATHER_CODES[code] || WEATHER_CODES[code&.-(code % 10)] || 'variable',
      temp_feel: temperature_descriptor((t_max + t_min) / 2),
      wet: precip > 1.0,
      frosty: t_min < 2.0,
    }
  rescue
    {}
  end

  def self.fetch_recent_sightings(date)
    conn = Faraday.new('https://api.inaturalist.org')
    response = conn.get('/v1/observations', {
      lat: LAT,
      lng: LON,
      radius: 40,
      d1: (date - 7).to_s,
      d2: date.to_s,
      quality_grade: 'research',
      per_page: 20,
      order: 'created_at',
      order_by: 'desc',
    })

    data = JSON.parse(response.body)
    results = data['results'] || []

    sightings = results.filter_map do |obs|
      taxon = obs['taxon']
      next unless taxon

      name  = taxon['preferred_common_name'] || taxon['name']
      group = taxon['iconic_taxon_name']
      next unless name

      { name: name, group: group }
    end

    sightings.uniq { |s| s[:name] }.first(12)
  rescue
    []
  end

  def self.build_prompt(date, weather, sightings)
    month_data = EARTH_CALENDAR[date.month - 1] || {}
    season     = month_data[:season] || 'temperate'
    bloom      = month_data[:bloom]&.join(', ') || 'various'
    month_name = date.strftime('%B')

    weather_context = []
    weather_context << "Conditions: #{weather[:condition]}" if weather[:condition]
    weather_context << "Temperature feel: #{weather[:temp_feel]}" if weather[:temp_feel]
    weather_context << 'Recent rain' if weather[:wet]
    weather_context << 'Frost possible overnight' if weather[:frosty]

    sighting_lines = sightings.map { |s| "- #{s[:name]}#{" (#{s[:group]})" if s[:group]}" }.join("\n")

    # rubocop:disable I18n/RailsI18n/DecorateString
    <<~PROMPT
      You are writing a short daily nature note for people in Melbourne, Australia.
      Today is #{date.strftime('%A, %-d %B %Y')}.

      STYLE RULES (follow exactly):
      - Length: 3 to 5 sentences, 25 to 60 words total
      - Shape: medium opener, longer middle sentence carrying the expansion, one or two short sentences to close. The rhythm should step forward.
      - Two beats minimum: every note needs at least two distinct ideas. A fact, then a wider observation it opens onto — or a fact, then something to notice. Never three sentences saying the same thing from different angles.
      - No em-dashes. None. Use full stops, commas, or colons instead.
      - No imperatives: never use "step outside", "look for", "notice", "listen for", "watch for", "check", "go outside", or any instruction verb.
      - Do not open with a verb.
      - Do not mention specific weather data (temperature numbers, rainfall mm, etc.). Weather context should shape the mood and imagery — not appear in the text.
      - Closing line: a quiet invitation, not a question. "Worth a look on your walk." not "Have you seen any frost this week?"
      - Forbidden: prediction ("Today brings..."), mood attribution to natural phenomena, telling the reader how they feel, asserting collective experience with "we".
      - Voice: present tense, observational. Like a naturalist's field note, not a blog post.

      WORKED EXAMPLE (this is the target register):
      "Frost finds the low ground first. Cold air drains downhill overnight and pools in the hollows. The slopes stay clear. Worth a look on your walk."

      ECOLOGICAL CONTEXT (use to inform the writing, do not quote directly):
      Season: #{season} in Melbourne
      Month: #{month_name}
      #{weather_context.join("\n      ")}
      Currently in bloom nearby: #{bloom}

      RECENT LOCAL SIGHTINGS near Melbourne (iNaturalist, last 7 days):
      #{sighting_lines.presence || 'No recent data'}

      Write the daily note now. Output only the note text — no preamble, no explanation.
    PROMPT
    # rubocop:enable I18n/RailsI18n/DecorateString
  end

  def self.call_claude(prompt)
    api_key = ENV.fetch('ANTHROPIC_API_KEY', nil)
    return nil if api_key.blank?

    conn = Faraday.new('https://api.anthropic.com') do |f|
      f.headers['x-api-key']         = api_key
      f.headers['anthropic-version'] = '2023-06-01'
      f.headers['content-type']      = 'application/json'
    end

    response = conn.post('/v1/messages', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }.to_json)

    data = JSON.parse(response.body)
    data.dig('content', 0, 'text')&.strip
  rescue
    nil
  end

  def self.temperature_descriptor(avg)
    if avg < 5
      'very cold'
    elsif avg < 10
      'cold'
    elsif avg < 15
      'cool'
    elsif avg < 20
      'mild'
    elsif avg < 26
      'warm'
    else
      'hot'
    end
  end
end
