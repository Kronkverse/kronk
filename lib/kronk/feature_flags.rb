# frozen_string_literal: true

# Kronk::FeatureFlags — boolean gates for phased rollout.
#
# Flags live in config/feature_flags.yaml. Shape:
#
#   default:
#     tune_in_enforced: false
#   test:
#     tune_in_enforced: false
#
# Rails.env-specific blocks override `default:`. A flag not declared
# anywhere resolves to `false` — off is the safe default.
#
# Usage:
#   Kronk::FeatureFlags.enabled?(:tune_in_enforced)
#
# For tests, use `with_flag` to swap a value inside a block:
#   Kronk::FeatureFlags.with_flag(tune_in_enforced: true) { ... }
#
# See docs/kronk_korner_spec.md §10 for how flags gate rebuild work.

module Kronk
  class FeatureFlags
    class << self
      def enabled?(flag)
        flags[flag.to_s] == true
      end

      def flags
        @flags ||= load_flags
      end

      def reload!
        @flags = nil
      end

      def with_flag(**overrides)
        original = flags.dup
        @flags = original.merge(overrides.transform_keys(&:to_s))
        yield
      ensure
        @flags = original
      end

      private

      def load_flags
        path = Rails.root.join('config', 'feature_flags.yaml')
        return {} unless File.exist?(path)

        yaml = YAML.safe_load_file(path)
        return {} unless yaml.is_a?(Hash)

        base = yaml['default'].is_a?(Hash) ? yaml['default'] : {}
        env_overrides = yaml[Rails.env.to_s].is_a?(Hash) ? yaml[Rails.env.to_s] : {}
        base.merge(env_overrides).transform_keys(&:to_s)
      end
    end
  end
end
