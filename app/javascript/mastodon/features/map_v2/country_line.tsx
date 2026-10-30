import { useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { ApiMapCountryJSON } from 'mastodon/api/map';

// The First Nations Country something on the map is on, worked out by the
// server from where it is (Kronk::FirstNationsCountries; docs/spaces/map.md,
// First Nations Country). "On Kaurna Country", or for a Trek "Through Kaurna
// and Peramangk Country"; each opens that Country on the map. A shape with no
// name yet says nothing.

const countryPath = (name: string) =>
  `/hub/map?country=${encodeURIComponent(name)}`;

export const CountryLine: React.FC<{
  country?: ApiMapCountryJSON | null;
  className?: string;
}> = ({ country, className }) => {
  const intl = useIntl();
  if (!country?.name) return null;

  return (
    <div className={`map-country-line ${className ?? ''}`}>
      <Link to={countryPath(country.name)}>
        {intl.formatMessage(
          { id: 'map.country_line.on', defaultMessage: 'On {name} Country' },
          { name: country.name },
        )}
      </Link>
    </div>
  );
};

export const CountriesLine: React.FC<{
  countries?: ApiMapCountryJSON[];
  className?: string;
}> = ({ countries, className }) => {
  const intl = useIntl();
  const named = (countries ?? []).filter(
    (c): c is ApiMapCountryJSON & { name: string } => !!c.name,
  );
  if (named.length === 0) return null;

  const links = named.map((c) => (
    <Link key={c.id} to={countryPath(c.name)}>
      {c.name}
    </Link>
  ));

  return (
    <div className={`map-country-line ${className ?? ''}`}>
      {intl.formatMessage(
        {
          id: 'map.country_line.through',
          defaultMessage: 'Through {names} Country',
        },
        { names: intl.formatList(links, { type: 'conjunction' }) },
      )}
    </div>
  );
};
