# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/klot.md: the owner's own cycle ("My cycle").
RSpec.describe 'Klot self' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:today)   { Time.zone.today }

  def start_period(date)
    post '/api/v1/klot/self/logs', params: { started_on: date.iso8601 }, headers: headers
  end

  describe 'GET /api/v1/klot/self' do
    it 'answers with a typical cycle, marked as not yet known, and no logs for someone new' do
      get '/api/v1/klot/self', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('cycle_length' => 28, 'cycle_known' => false, 'period_known' => false, 'next_period' => nil, 'logs' => [])
    end
  end

  describe 'POST /api/v1/klot/self/logs' do
    it 'records a period start and returns the day of the cycle' do
      start_period(today - 2)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('day_of_cycle' => 3, 'phase' => 'menstrual', 'bleeding' => true)
      expect(response.parsed_body['logs']).to contain_exactly(include('started_on' => (today - 2).iso8601, 'ended_on' => nil))
    end

    it 'works out the cycle from the second period, in whatever order they are logged' do
      start_period(today - 2)
      start_period(today - 32)

      expect(response.parsed_body).to include('cycle_length' => 30, 'cycle_known' => true, 'cycles_logged' => 1)
      expect(response.parsed_body['next_period']).to include('expected_on' => (today + 28).iso8601)
    end

    it 'closes a period left open when the next one starts' do
      start_period(today - 30)
      start_period(today)

      older = response.parsed_body['logs'].last
      expect(older).to include('started_on' => (today - 30).iso8601, 'ended_on' => (today - 26).iso8601, 'length' => 5)
    end

    it 'refuses a second period on a day one already covers' do
      start_period(today - 3)
      start_period(today - 3)

      expect(response).to have_http_status(422)
    end
  end

  describe 'PATCH /api/v1/klot/self/logs/:id' do
    before { start_period(today - 6) }

    let(:log) { CycleLog.find_by!(account: user.account) }

    it 'ends the period, which sets how long the bleed was' do
      patch "/api/v1/klot/self/logs/#{log.id}", params: { ended_on: (today - 3).iso8601 }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('bleeding' => false, 'period_length' => 4, 'period_known' => true, 'phase' => 'follicular')
    end

    it 'refuses an end before the start' do
      patch "/api/v1/klot/self/logs/#{log.id}", params: { ended_on: (today - 9).iso8601 }, headers: headers

      expect(response).to have_http_status(422)
      expect(log.reload.ended_on).to be_nil
    end

    it "cannot touch someone else's period" do
      other = CycleLog.create!(account: Fabricate(:account), started_on: today - 4)

      patch "/api/v1/klot/self/logs/#{other.id}", params: { ended_on: today.iso8601 }, headers: headers

      expect(response).to have_http_status(404)
    end
  end

  describe 'days' do
    it 'keeps how a day was, gives a month back, and drops a day once it is emptied' do
      put "/api/v1/klot/self/days/#{(today - 1).iso8601}", params: { flow: 'heavy', symptoms: %w(cramps tired made_up), note: ' rough one ' }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('flow' => 'heavy', 'symptoms' => %w(cramps tired), 'note' => 'rough one')

      get '/api/v1/klot/self/days', params: { from: (today - 10).iso8601, to: today.iso8601 }, headers: headers
      expect(response.parsed_body).to contain_exactly(include('day' => (today - 1).iso8601, 'flow' => 'heavy'))

      put "/api/v1/klot/self/days/#{(today - 1).iso8601}", params: { flow: '', symptoms: [''], note: '' }, headers: headers
      expect(CycleDay.where(account: user.account)).to be_empty
    end

    it "never shows another person's days" do
      CycleDay.create!(account: Fabricate(:account), day: today, flow: 'light')

      get '/api/v1/klot/self/days', params: { from: (today - 5).iso8601, to: today.iso8601 }, headers: headers

      expect(response.parsed_body).to eq([])
    end

    it 'refuses a flow it does not know' do
      put "/api/v1/klot/self/days/#{today.iso8601}", params: { flow: 'torrential' }, headers: headers

      expect(response).to have_http_status(422)
    end
  end

  describe 'DELETE /api/v1/klot/self/data' do
    it 'removes every period and every day, and only your own' do
      start_period(today - 3)
      put "/api/v1/klot/self/days/#{today.iso8601}", params: { flow: 'light' }, headers: headers
      kept = CycleDay.create!(account: Fabricate(:account), day: today, flow: 'light')

      delete '/api/v1/klot/self/data', headers: headers

      expect(response.parsed_body).to include('logs' => [])
      expect(CycleDay.where(account: user.account)).to be_empty
      expect(CycleDay.exists?(kept.id)).to be true
    end
  end

  describe 'PATCH /api/v1/klot/self/settings' do
    it 'keeps a typed cycle length as the stand-in until the log has one' do
      patch '/api/v1/klot/self/settings', params: { cycle_length: 30 }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('cycle_length' => 30, 'cycle_known' => false)
    end
  end
end
