# frozen_string_literal: true

# Kronk as an OpenID Connect provider — "Sign in with Kronk".
#
# Mastodon already speaks OAuth (Doorkeeper) and serves /oauth/userinfo,
# but issues no ID token, publishes no signing key and has no
# /.well-known/openid-configuration. doorkeeper-openid_connect adds those,
# so any OIDC-capable site (shadow first; later things like CommYOUnity or
# YOU) can let a member sign in with their Kronk account by configuration
# alone: a client id, a secret and this instance's address.
#
# What a site learns: the member's permanent id (`sub`), username, display
# name, avatar and profile link — the same fields as /oauth/userinfo. No
# email, no posts. Each member approves each site, and can revoke it from
# their authorised apps.
#
# Signing key: an RSA private key in PEM form, from OIDC_SIGNING_KEY (keep it
# in the env file, never the repo). Without one, a key is generated at boot.
# That works — Puma preloads, so every worker shares it — but it changes on
# every restart, so a site that cached the old public key fails until it
# refetches. Production and shadow should set OIDC_SIGNING_KEY.

signing_key = ENV.fetch('OIDC_SIGNING_KEY', nil).presence&.gsub('\n', "\n")

if signing_key.nil?
  Rails.logger.warn('OIDC_SIGNING_KEY is not set; using a key generated at boot (it changes on restart)') if Rails.env.production?
  signing_key = OpenSSL::PKey::RSA.generate(2048).to_pem
end

Doorkeeper::OpenidConnect.configure do
  issuer do |_resource_owner, _application|
    protocol = Rails.configuration.x.use_https ? 'https' : 'http'
    "#{protocol}://#{Rails.configuration.x.web_domain}"
  end

  signing_key signing_key
  signing_algorithm :rs256
  subject_types_supported [:public]

  # Mastodon's resource owner is the User; the identity is the Account.
  resource_owner_from_access_token do |access_token|
    User.find_by(id: access_token.resource_owner_id)
  end

  auth_time_from_resource_owner(&:current_sign_in_at)

  # prompt=login: sign them out and send them back here after signing in.
  reauthenticate_resource_owner do |user, return_to|
    store_location_for(user, return_to)
    sign_out(user)
    redirect_to new_user_session_url
  end

  # prompt=select_account: Kronk's account switcher lives on the sign-in page.
  select_account_for_resource_owner do |user, return_to|
    store_location_for(user, return_to)
    sign_out(user)
    redirect_to new_user_session_url
  end

  # Must match `sub` from /oauth/userinfo (OAuthUserinfoSerializer): the
  # account id, which never changes — unlike the ActivityPub URI, which
  # embeds the domain.
  subject do |user, _application|
    user.account_id.to_s
  end

  # ID tokens are short-lived; the site exchanges the code immediately.
  expiration 600

  # The same values /oauth/userinfo returns, built by the same serializer,
  # so the ID token and userinfo always agree.
  claims do
    %i(preferred_username name picture profile).each do |field|
      # In the ID token itself: Mastodon's /oauth/userinfo serves the same
      # fields, so the library's own userinfo endpoint is switched off.
      claim field, scope: :openid, response: [:id_token] do |user, _scopes, _access_token|
        OAuthUserinfoSerializer.new(user.account).public_send(field)
      end
    end
  end
end
