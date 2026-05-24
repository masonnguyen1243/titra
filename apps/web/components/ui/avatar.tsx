import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-9 w-9 text-sm',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const base = cn(
    'rounded-full shrink-0 flex items-center justify-center font-semibold bg-muted overflow-hidden',
    SIZE_CLASSES[size],
    className,
  );

  if (src) {
    return (
      // Plain <img> avoids next/image domain config requirements for Cloudinary URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cn(base, 'object-cover')} />
    );
  }

  return (
    <div className={base} role="img" aria-label={name}>
      {getInitials(name)}
    </div>
  );
}
