export function PostHogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M64 128L0 64h32L64 96l32-32h32L64 128z" fill="#1D4AFF"/>
      <path d="M64 96L0 32h32L64 64l32-32h32L64 96z" fill="#1D4AFF" opacity="0.7"/>
      <path d="M64 64L0 0h32l32 32 32-32h32L64 64z" fill="#1D4AFF" opacity="0.4"/>
    </svg>
  );
}
