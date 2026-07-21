import { FormattedDate, FormattedMessage } from 'react-intl';

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);

// Renders a divider between conversation-stream items when the date
// changes. "Today" / "Yesterday" / locale-formatted month-day
// otherwise. Kept small on purpose — recedes so the messages lead.
export const DaySeparator: React.FC<{ timestamp: string }> = ({
  timestamp,
}) => {
  const then = new Date(timestamp);
  const now = new Date();
  const delta = daysBetween(now, then);

  let label: React.ReactNode;
  if (delta === 0) {
    label = <FormattedMessage id='nudges.day.today' defaultMessage='Today' />;
  } else if (delta === 1) {
    label = (
      <FormattedMessage id='nudges.day.yesterday' defaultMessage='Yesterday' />
    );
  } else {
    label = (
      <FormattedDate value={then} weekday='short' month='short' day='numeric' />
    );
  }

  return (
    <div className='nudges-day-separator' role='separator'>
      <span className='nudges-day-separator__label'>{label}</span>
    </div>
  );
};
