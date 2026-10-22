import { Avatar } from 'mastodon/components/avatar';
import { AvatarGroup } from 'mastodon/components/avatar_group';

export interface StackedFace {
  id: string;
  acct: string;
  avatar: string;
}

// People as their faces, overlapping, in place of a count ("3 contributors").
// `total` is how many there are in all, so the stack can end in "+N" when it
// shows fewer. `label` says the count for screen readers, since the faces
// carry it visually.
export const AvatarStack: React.FC<{
  faces: StackedFace[];
  total: number;
  label: string;
  size?: number;
  className?: string;
}> = ({ faces, total, label, size = 26, className }) => {
  if (faces.length === 0) return null;

  const more = total - faces.length;

  return (
    <span
      className={className ? `avatar-stack ${className}` : 'avatar-stack'}
      role='img'
      aria-label={label}
      title={faces.map((face) => `@${face.acct}`).join(', ')}
    >
      <AvatarGroup compact avatarHeight={size}>
        {faces.map((face) => (
          <Avatar
            key={face.id}
            account={{ ...face, avatar_static: face.avatar }}
            size={size}
          />
        ))}
        {more > 0 && (
          <span className='avatar-stack__more' style={{ height: size }}>
            +{more}
          </span>
        )}
      </AvatarGroup>
    </span>
  );
};
