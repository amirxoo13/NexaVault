import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function AddressQr({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#06090e", light: "#eef4f8" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return <div className="rounded-2xl bg-foreground" style={{ width: size, height: size }} />;
  }

  return (
    <div className="rounded-2xl bg-[#eef4f8] p-2.5 shadow-[0_0_30px_rgb(16_185_129/0.2)]">
      <img src={src} alt="Receive QR" width={size} height={size} className="rounded-xl" />
    </div>
  );
}
