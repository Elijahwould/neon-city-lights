import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "solid",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" | "danger" }) {
  const look = {
    solid: "bg-pink text-black hover:brightness-110",
    ghost: "border border-cyan/50 text-cyan hover:bg-cyan/10",
    danger: "border border-pink/60 text-pink hover:bg-pink/10",
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold tracking-wide disabled:opacity-40 ${look} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      {children}
    </label>
  );
}

const control = "w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-base outline-none focus:border-cyan";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={control} {...props} />;
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-24`} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={control} {...props} />;
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs tracking-wide ${active ? "border-pink bg-pink text-black" : "border-white/15 text-muted"}`}
    >
      {children}
    </button>
  );
}
