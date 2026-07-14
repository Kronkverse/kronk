import { useCallback, useRef, useState } from 'react';

const GENRES = [
  'Acid House',
  'Acid Techno',
  'Afro House',
  'Afrobeats',
  'Amapiano',
  'Ambient',
  'Bass Music',
  'Breakbeat',
  'Breaks',
  'Chicago House',
  'Chillwave',
  'Dark Ambient',
  'Dark Disco',
  'Darksynth',
  'Deep House',
  'Detroit Techno',
  'Drum and Bass',
  'Dubstep',
  'EBM',
  'Electro',
  'Electroclash',
  'Electronic',
  'Experimental',
  'Footwork',
  'Frenchcore',
  'Future Bass',
  'Gabber',
  'Goa Trance',
  'Grime',
  'Halftime',
  'Happy Hardcore',
  'Hard Techno',
  'Hard Trance',
  'Hardcore',
  'Hardstyle',
  'House',
  'IDM',
  'Industrial',
  'Industrial Techno',
  'Italo Disco',
  'Juke',
  'Jungle',
  'Latin House',
  'Liquid DnB',
  'Lo-fi',
  'Melodic House',
  'Melodic Techno',
  'Minimal Techno',
  'Neurofunk',
  'Nu-Disco',
  'Organic House',
  'Progressive House',
  'Progressive Trance',
  'Psybreaks',
  'Psytrance',
  'Rave',
  'Reggaeton',
  'Riddim',
  'Speed',
  'Synthwave',
  'Tech House',
  'Techno',
  'Trance',
  'Trap',
  'UK Bass',
  'UK Garage',
];

interface Props {
  value: string[];
  onChange: (genres: string[]) => void;
  disabled?: boolean;
  maxTags?: number;
}

export const GenreTagInput: React.FC<Props> = ({
  value,
  onChange,
  disabled,
  maxTags = 5,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = inputValue.trim()
    ? GENRES.filter(
        (g) =>
          g.toLowerCase().includes(inputValue.toLowerCase()) &&
          !value.includes(g),
      ).slice(0, 6)
    : [];

  const addGenre = useCallback(
    (genre: string) => {
      const trimmed = genre.trim();
      if (!trimmed || value.includes(trimmed) || value.length >= maxTags)
        return;
      onChange([...value, trimmed]);
      setInputValue('');
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [value, onChange, maxTags],
  );

  const removeGenre = useCallback(
    (genre: string) => {
      onChange(value.filter((g) => g !== genre));
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (inputValue.trim()) addGenre(inputValue);
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        onChange(value.slice(0, -1));
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [inputValue, value, onChange, addGenre],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      setShowSuggestions(true);
    },
    [],
  );

  const atMax = value.length >= maxTags;

  return (
    <div className='booth-genre-input'>
      <div
        className='booth-genre-input__field'
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((genre) => (
          <span key={genre} className='booth-genre-input__tag'>
            {genre}
            <button
              type='button'
              className='booth-genre-input__tag-remove'
              onClick={(e) => {
                e.stopPropagation();
                removeGenre(genre);
              }}
              disabled={disabled}
              aria-label={`Remove ${genre}`}
            >
              ×
            </button>
          </span>
        ))}
        {!atMax && (
          <input
            ref={inputRef}
            className='booth-genre-input__text'
            type='text'
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => { setShowSuggestions(false); }, 150)}
            placeholder={value.length === 0 ? 'Add genres…' : ''}
            disabled={disabled}
          />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className='booth-genre-input__suggestions'>
          {suggestions.map((g) => (
            <button
              key={g}
              type='button'
              className='booth-genre-input__suggestion'
              onMouseDown={(e) => {
                e.preventDefault();
                addGenre(g);
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
