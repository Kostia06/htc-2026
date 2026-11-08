import type { ReactNode } from "react";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Props = { isDisabled: boolean; onDigit: (digit: string) => void; onBackspace: () => void };

export function Keypad({ isDisabled, onDigit, onBackspace }: Props) {
  const digitKey = (digit: string) => (
    <Key key={digit} isDisabled={isDisabled} onPress={() => onDigit(digit)}>
      {digit}
    </Key>
  );

  return (
    <div className="keypad" role="group" aria-label="Number pad">
      {DIGITS.map(digitKey)}
      <span aria-hidden="true" />
      {digitKey("0")}
      <Key isDisabled={isDisabled} onPress={onBackspace} label="Delete last digit" isQuiet>
        <BackspaceIcon />
      </Key>
    </div>
  );
}

type KeyProps = { isDisabled: boolean; onPress: () => void; label?: string; isQuiet?: boolean; children: ReactNode };

function Key({ isDisabled, onPress, label, isQuiet = false, children }: KeyProps) {
  return (
    <button
      type="button"
      className={isQuiet ? "key key-quiet" : "key"}
      disabled={isDisabled}
      aria-label={label}
      // pointerdown, not click: a controller trigger registers on the pull, not the release, so typing feels instant
      onPointerDown={(event) => event.button === 0 && onPress()}
      // detail 0 is a keyboard or screen-reader activation, which sends no pointer events
      onClick={(event) => event.detail === 0 && onPress()}
    >
      {children}
    </button>
  );
}

function BackspaceIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
      <path d="m12 9 6 6m0-6-6 6" />
    </svg>
  );
}
