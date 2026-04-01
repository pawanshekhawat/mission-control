"use client";

import dynamic from "next/dynamic";
import Sidebar from "../components/Sidebar";

const Office3D = dynamic(() => import("../components/Office3D"), { ssr: false });

export default function OfficePage() {
  return (
    <div className="flex h-full" style={{ background: "#0a0a14" }}>
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <Office3D />
      </main>
    </div>
  );
}
