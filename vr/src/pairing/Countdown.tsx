import { useEffect, useState } from "react";
import { formatCountdown, secondsUntil } from "./code";

export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className="countdown">New code in {formatCountdown(secondsUntil(deadline, now))}</span>;
}
