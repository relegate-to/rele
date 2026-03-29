// components/bg-effects.tsx

export function NoiseGrain() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0 dark:hidden mix-blend-multiply bg-[url('data:image/svg+xml,%3Csvg viewBox=%270 0 512 512%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.75%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.08%27/%3E%3C/svg%3E')] bg-[length:512px_512px]"
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0 hidden dark:block mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%270 0 512 512%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.75%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.06%27/%3E%3C/svg%3E')] bg-[length:512px_512px]"
      />
    </>
  );
}

export function Vignette() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%),
          radial-gradient(ellipse at 50% 100%, var(--bg) 0%, transparent 70%)
        `,
      }}
    />
  );
}
