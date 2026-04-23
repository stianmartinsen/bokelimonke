import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  fullWidth = true,
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "rounded-2xl px-5 py-4 text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-ink text-cream hover:bg-ink/90",
    secondary: "bg-lemon text-ink hover:bg-lemon-dark border border-ink/5",
    ghost: "bg-transparent text-ink hover:bg-ink/5",
  };
  return (
    <button
      {...rest}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    />
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function TextField({ label, hint, className = "", ...rest }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      {label ? <span className="text-sm font-semibold opacity-80">{label}</span> : null}
      <input
        {...rest}
        className={`rounded-2xl border border-ink/10 bg-white px-4 py-4 text-lg outline-none focus:border-ink focus:ring-2 focus:ring-lemon ${className}`}
      />
      {hint ? <span className="text-sm opacity-60">{hint}</span> : null}
    </label>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function TextArea({ label, hint, className = "", ...rest }: TextAreaProps) {
  return (
    <label className="flex flex-col gap-2">
      {label ? <span className="text-sm font-semibold opacity-80">{label}</span> : null}
      <textarea
        {...rest}
        className={`min-h-[120px] rounded-2xl border border-ink/10 bg-white px-4 py-3 text-lg outline-none focus:border-ink focus:ring-2 focus:ring-lemon ${className}`}
      />
      {hint ? <span className="text-sm opacity-60">{hint}</span> : null}
    </label>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-3xl border border-ink/5 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

interface PageProps {
  children: ReactNode;
  className?: string;
}

export function Page({ children, className = "" }: PageProps) {
  return (
    <div
      className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-10 pt-8 ${className}`}
    >
      {children}
    </div>
  );
}

interface BannerProps {
  tone?: "info" | "error";
  children: ReactNode;
}

export function Banner({ tone = "info", children }: BannerProps) {
  const tones: Record<Required<BannerProps>["tone"], string> = {
    info: "bg-lemon/40 text-ink",
    error: "bg-coral/15 text-coral border border-coral/40",
  };
  return <div className={`rounded-2xl px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Spinner() {
  return (
    <div
      aria-label="Loading"
      className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
    />
  );
}
