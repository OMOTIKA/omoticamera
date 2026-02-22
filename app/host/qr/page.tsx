"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HostQrRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const eid = (localStorage.getItem("omoticamera_eventId") || "").trim();
    if (eid) {
      router.replace(`/host/qr/${encodeURIComponent(eid)}`);
    } else {
      router.replace("/host/home");
    }
  }, [router]);

  return null;
}
