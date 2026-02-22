"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function HostPhotosByEventIdRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const urlEventId = String((params as any)?.eventId || "").trim();

  useEffect(() => {
    if (urlEventId) {
      localStorage.setItem("omoticamera_eventId", urlEventId);
      router.replace("/host/photos"); // 既存の /host/photos/page.tsx を使う
    } else {
      router.replace("/host/home");
    }
  }, [router, urlEventId]);

  return null;
}
