export function PasswordStrength({ password }: { password: string }) {
  const score = getPasswordScore(password);
  const labels = ["Empty", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-muted", "bg-destructive", "bg-amber-500", "bg-secondary", "bg-primary"];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className={`h-1.5 flex-1 rounded-full transition-[background-color] duration-150 ${
              score >= item ? colors[score] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Password strength: {labels[score]}
      </div>
    </div>
  );
}

export function getPasswordScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, Math.max(1, score));
}
