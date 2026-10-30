import { apiRequestDelete, apiRequestGet, apiRequestPost } from 'mastodon/api';

// The open list of First Nations Country names (docs/spaces/map.md, First
// Nations Country). Mirrors app/controllers/api/v1/map/country_names_controller.rb.
// Names typed on profiles join it on their own; anyone adds another name to a
// Country on the map (which says which shape it names); a steward takes one
// off. Kronk's own list (components/first_nations_countries.ts) and the names
// on the map's shapes come on top of these.

export interface ApiMapCountryNameJSON {
  id: string;
  name: string;
  // The Country shape on the map it names, once someone has said which.
  shape_id: number | null;
  added_by: { id: string; acct: string } | null;
  // Whether you can take it off the list (stewards).
  can_remove: boolean;
}

export const apiGetCountryNames = () =>
  apiRequestGet<ApiMapCountryNameJSON[]>('v1/map/country_names');

export const apiAddCountryName = (name: string, shapeId: number) =>
  apiRequestPost<ApiMapCountryNameJSON>('v1/map/country_names', {
    name,
    shape_id: shapeId,
  });

export const apiRemoveCountryName = (id: string) =>
  apiRequestDelete(`v1/map/country_names/${id}`);
