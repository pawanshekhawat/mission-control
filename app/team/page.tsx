import Sidebar from "../components/Sidebar";
import TeamGrid from "../components/TeamGrid";

export default function TeamPage() {
  return (
    <div className="flex h-full" style={{ background: "#0a0a14" }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <TeamGrid />
      </main>
    </div>
  );
}
