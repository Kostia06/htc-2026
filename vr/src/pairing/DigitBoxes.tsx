import { CODE_LENGTH } from "./keypadState";

type Props = { digits: string; isChecking: boolean; isWrong: boolean; shakes: number };

export function DigitBoxes({ digits, isChecking, isWrong, shakes }: Props) {
  const classes = ["digit-boxes", isChecking && "is-checking", isWrong && "is-wrong", shakes > 0 && isWrong && "shake"].filter(Boolean).join(" ");
  return (
    // a new key restarts the shake animation on every wrong code, not just the first
    <div key={shakes} className={classes} aria-label={`Code, ${digits.length} of ${CODE_LENGTH} digits entered`} role="status">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <span key={index} className={index === digits.length && !isChecking ? "digit-box is-next" : "digit-box"}>
          {digits[index] ?? ""}
        </span>
      ))}
    </div>
  );
}
