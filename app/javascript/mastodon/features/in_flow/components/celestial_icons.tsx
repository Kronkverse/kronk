// Minimal white SVG icons for celestial events — no fill, thin stroke.

// Mapping from moon phase name to icon component
import type { MoonPhaseName } from 'mastodon/features/events/components/celestial_calendar';

interface IconProps {
  size?: number;
  className?: string;
}

interface MoonIconProps extends IconProps {
  waning?: boolean;
}

export const SunIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    className={className}
  >
    <circle cx='12' cy='12' r='4' />
    <line x1='12' y1='2' x2='12' y2='5' />
    <line x1='12' y1='19' x2='12' y2='22' />
    <line x1='2' y1='12' x2='5' y2='12' />
    <line x1='19' y1='12' x2='22' y2='12' />
    <line x1='4.22' y1='4.22' x2='6.34' y2='6.34' />
    <line x1='17.66' y1='17.66' x2='19.78' y2='19.78' />
    <line x1='19.78' y1='4.22' x2='17.66' y2='6.34' />
    <line x1='6.34' y1='17.66' x2='4.22' y2='19.78' />
  </svg>
);

export const MoonNewIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    className={className}
  >
    <circle cx='12' cy='12' r='9' />
  </svg>
);

export const MoonCrescentIcon: React.FC<MoonIconProps> = ({
  size = 24,
  className,
  waning = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    className={className}
  >
    {waning ? (
      <path d='M17 12A9 9 0 1 1 12 3 7 7 0 0 0 17 12z' />
    ) : (
      <path d='M7 12A9 9 0 1 0 12 3 7 7 0 0 1 7 12z' />
    )}
  </svg>
);

export const MoonHalfIcon: React.FC<MoonIconProps> = ({
  size = 24,
  className,
  waning = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    className={className}
  >
    <path
      d={
        waning ? 'M12 3 A9 9 0 0 0 12 21 L12 3' : 'M12 3 A9 9 0 0 1 12 21 L12 3'
      }
    />
    <line x1='12' y1='3' x2='12' y2='21' />
  </svg>
);

export const MoonGibbousIcon: React.FC<MoonIconProps> = ({
  size = 24,
  className,
  waning = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    className={className}
  >
    {waning ? (
      <path d='M12 3 A9 9 0 0 0 12 21 Q5 17 5 12 Q5 7 12 3z' />
    ) : (
      <path d='M12 3 A9 9 0 0 1 12 21 Q19 17 19 12 Q19 7 12 3z' />
    )}
  </svg>
);

export const MoonFullIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='currentColor'
    className={className}
  >
    <circle cx='12' cy='12' r='9' />
  </svg>
);

export const LeafIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    className={className}
  >
    <path d='M6 20 Q6 10 18 4 Q18 14 6 20z' />
    <line x1='6' y1='20' x2='14' y2='12' />
  </svg>
);

export const FlameIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <path d='M12 2 Q15 6 14 10 Q17 7 16 12 Q18 10 17 14 Q17 20 12 22 Q7 20 7 14 Q6 10 8 12 Q7 7 10 10 Q9 6 12 2z' />
  </svg>
);

export const StarIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <polygon points='12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9' />
  </svg>
);

export const OrbitIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    className={className}
  >
    <ellipse cx='12' cy='12' rx='10' ry='5' />
    <ellipse cx='12' cy='12' rx='5' ry='10' />
    <circle cx='12' cy='12' r='2' fill='currentColor' />
  </svg>
);

export const SnowflakeIcon: React.FC<IconProps> = ({
  size = 24,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    className={className}
  >
    <line x1='12' y1='2' x2='12' y2='22' />
    <line x1='2' y1='12' x2='22' y2='12' />
    <line x1='4.93' y1='4.93' x2='19.07' y2='19.07' />
    <line x1='19.07' y1='4.93' x2='4.93' y2='19.07' />
    <line x1='12' y1='6' x2='10' y2='4' />
    <line x1='12' y1='6' x2='14' y2='4' />
    <line x1='12' y1='18' x2='10' y2='20' />
    <line x1='12' y1='18' x2='14' y2='20' />
    <line x1='6' y1='12' x2='4' y2='10' />
    <line x1='6' y1='12' x2='4' y2='14' />
    <line x1='18' y1='12' x2='20' y2='10' />
    <line x1='18' y1='12' x2='20' y2='14' />
  </svg>
);

export const BlossomIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    className={className}
  >
    <circle cx='12' cy='12' r='3' />
    <ellipse cx='12' cy='6' rx='2' ry='4' />
    <ellipse cx='12' cy='18' rx='2' ry='4' />
    <ellipse cx='6' cy='12' rx='4' ry='2' />
    <ellipse cx='18' cy='12' rx='4' ry='2' />
    <ellipse
      cx='7.76'
      cy='7.76'
      rx='2'
      ry='4'
      transform='rotate(45 7.76 7.76)'
    />
    <ellipse
      cx='16.24'
      cy='16.24'
      rx='2'
      ry='4'
      transform='rotate(45 16.24 16.24)'
    />
  </svg>
);

export const SunsetIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    className={className}
  >
    <line x1='2' y1='16' x2='22' y2='16' />
    <path d='M5 16 A7 7 0 0 1 19 16' />
    <line x1='12' y1='9' x2='12' y2='6' />
    <line x1='6.34' y1='11.66' x2='4.22' y2='9.54' />
    <line x1='17.66' y1='11.66' x2='19.78' y2='9.54' />
    <line x1='2' y1='20' x2='22' y2='20' />
  </svg>
);

export const MoonPhaseIcon = ({
  phase,
  size = 24,
}: {
  phase: MoonPhaseName;
  size?: number;
}) => {
  switch (phase) {
    case 'new_moon':
      return <MoonNewIcon size={size} />;
    case 'waxing_crescent':
      return <MoonCrescentIcon size={size} />;
    case 'first_quarter':
      return <MoonHalfIcon size={size} />;
    case 'waxing_gibbous':
      return <MoonGibbousIcon size={size} />;
    case 'full_moon':
      return <MoonFullIcon size={size} />;
    case 'waning_gibbous':
      return <MoonGibbousIcon size={size} waning />;
    case 'last_quarter':
      return <MoonHalfIcon size={size} waning />;
    case 'waning_crescent':
      return <MoonCrescentIcon size={size} waning />;
  }
};
