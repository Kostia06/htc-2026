import QRCode from "qrcode";
import { useMemo } from "react";

// phone scanners need four light modules of margin around the code
const QUIET_ZONE = 4;

function darkModulesPath(value: string) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) path += `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { path, size: modules.size + QUIET_ZONE * 2 };
}

export function QrCode({ value, label }: { value: string; label: string }) {
  const { path, size } = useMemo(() => darkModulesPath(value), [value]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
