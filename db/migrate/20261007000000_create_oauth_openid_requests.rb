# frozen_string_literal: true

# Kronk: OpenID Connect ("Sign in with Kronk"). doorkeeper-openid_connect
# stores the `nonce` a site sends with each authorization request against
# the access grant, so it can put it back into the ID token and the site
# can reject replayed responses. Also the optional post-logout redirect
# list on applications, which the library reads when present.
class CreateOAuthOpenidRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :oauth_openid_requests do |t|
      t.references :access_grant, null: false, index: true, foreign_key: { to_table: :oauth_access_grants, on_delete: :cascade }
      t.string :nonce, null: false

      t.timestamps
    end

    add_column :oauth_applications, :post_logout_redirect_uris, :text
  end
end
