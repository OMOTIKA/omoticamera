"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HostEventRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const eid = (localStorage.getItem("omoticamera_eventId") || "").trim();
    if (eid) {
      router.replace(`/host/event/${encodeURIComponent(eid)}`);
    } else {
      router.replace("/host/home");
    }
  }, [router]);

  return null;
}
