# frozen_string_literal: true

# Checks what an Anthemos phone signs (docs/spaces/map.md, Live location).
#
# A linked phone keeps a P-256 key in its own keystore and gives Kronk only
# the public half (base64 DER). Every permission and every point it sends is
# signed with it, so Kronk can show "from Anthemos, signed", and someone
# holding only the account's token can't make one up. A message is short
# lines joined with "\n", led by what it is and a version, so one kind can
# never pass for another.
module Kronk::AnthemosSignature
  module_function

  # The phone's public key, or ArgumentError if it isn't a P-256 public key.
  def public_key(base64_der)
    key = OpenSSL::PKey.read(Base64.strict_decode64(base64_der.to_s))
    raise ArgumentError, 'not a P-256 public key' unless key.is_a?(OpenSSL::PKey::EC) && key.group.curve_name == 'prime256v1' && !key.private?

    key
  rescue OpenSSL::PKey::PKeyError
    raise ArgumentError, 'not a P-256 public key'
  end

  def valid?(base64_der, signature, *parts)
    public_key(base64_der).verify('SHA256', Base64.strict_decode64(signature.to_s), message(*parts))
  rescue ArgumentError, OpenSSL::PKey::PKeyError
    false
  end

  def message(*parts)
    parts.map(&:to_s).join("\n")
  end
end
