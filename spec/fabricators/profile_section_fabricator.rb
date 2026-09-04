# frozen_string_literal: true

# `section_type` is 'drawn' for every row — `SECTION_KINDS` narrowed to
# that alone when told-cards moved out of the section selector, and a
# shelf is invalid without a `render` in its settings (`render_is_present`).
# The fabricator still described the retired 'timeline' shape with no
# settings at all, so every `Fabricate(:profile_section)` raised
# "Section type is not included in the list, Settings shelf requires a
# render" — which took the fabricators spec and the sections request spec
# down with it.
Fabricator(:profile_section) do
  account
  section_type 'drawn'
  position 0
  settings { { 'render' => 'album', 'korner_slug' => 'albutts' } }
end
