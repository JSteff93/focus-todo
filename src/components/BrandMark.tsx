interface Props {
  size?: number;
}

export function BrandMark({ size = 22 }: Props) {
  return (
    <div className="app-brand">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="app-brand-icon">
        <rect x="14" y="18" width="36" height="7" rx="1" stroke="currentColor" strokeWidth="2.6" />
        <rect x="14" y="29" width="30" height="7" rx="1" stroke="currentColor" strokeWidth="2.6" />
        <rect x="14" y="40" width="22" height="7" rx="1" stroke="currentColor" strokeWidth="2.6" />
        <path d="M46 15 L50 19 L58 10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="app-brand-word">FOCUS<span className="app-brand-suffix">STACKS</span></span>
    </div>
  );
}
