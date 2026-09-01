"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

type SecretInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  revealLabel: string;
};

/** Shared masked input with an explicit, keyboard-operable reveal control. */
export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(
  function SecretInput(
    { className, disabled, id, revealLabel, ...inputProps },
    ref,
  ) {
    const [revealed, setRevealed] = useState(false);
    const inputClassName = ["secret-input-field", className]
      .filter(Boolean)
      .join(" ");

    return (
      <span className="secret-input">
        <input
          {...inputProps}
          className={inputClassName}
          disabled={disabled}
          id={id}
          ref={ref}
          spellCheck={false}
          type={revealed ? "text" : "password"}
        />
        <button
          aria-controls={id}
          aria-label={`${revealed ? "Hide" : "Show"} ${revealLabel}`}
          aria-pressed={revealed}
          className="secret-input-toggle"
          disabled={disabled}
          onClick={() => setRevealed((current) => !current)}
          type="button"
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </span>
    );
  },
);
