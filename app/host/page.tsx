"use client";

// UI_VER: HOST_ROOT_UI_V1_20260210

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HostRootPage() {
  const router = useRouter();

  useEffect(() => {
    const hostKey = localStorage.getItem("omoticamera_hostKey") || "";
    if (hostKey) router.replace("/host/dashboard");
    else router.replace("/host/login");
  }, [router]);

  return null;
}