import Sidebar from "../components/Sidebar";
import KanbanBoard from "../components/KanbanBoard";

export default function TasksPage() {
  return (
    <div className="flex h-full" style={{ background: "#0a0a14" }}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <KanbanBoard />
      </main>
    </div>
  );
}
