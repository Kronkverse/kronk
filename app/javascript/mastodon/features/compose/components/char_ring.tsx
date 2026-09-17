import { length } from 'stringz';

// CharRing — the character counter as a filling ring with the remaining count
// shown faintly in the middle. Fills purple as you type, turns amber in the last
// stretch, and reads red (with the negative overflow) once you're over the max.
// Replaces the bare number counter.

const R = 15;
const CIRC = 2 * Math.PI * R;

export const CharRing: React.FC<{ text: string; max: number }> = ({
  text,
  max,
}) => {
  const used = length(text);
  const left = max - used;
  const frac = Math.min(Math.max(used / max, 0), 1);
  const over = left < 0;
  const near = !over && left < Math.max(max * 0.04, 20);

  const modifier = over ? ' char-ring--over' : near ? ' char-ring--near' : '';

  return (
    <svg className={`char-ring${modifier}`} viewBox='0 0 36 36'>
      <circle className='char-ring__track' cx='18' cy='18' r={R} />
      <circle
        className='char-ring__fill'
        cx='18'
        cy='18'
        r={R}
        style={{
          strokeDasharray: CIRC,
          strokeDashoffset: over ? 0 : CIRC * (1 - frac),
        }}
      />
      <text className='char-ring__num' x='18' y='21' textAnchor='middle'>
        {left}
      </text>
    </svg>
  );
};
