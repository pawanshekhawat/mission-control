"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Suspense, useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";

// ─── Types ───────────────────────────────────────────────────────────────────
type AgentData = {
  name: string; emoji: string; color: string; role: string;
  pos: [number, number, number];
};
type AgentState = {
  status: "working" | "idle" | "on-break";
  currentTask: string;
  completedCount: number;
};
type AgentGlobalState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  state: "idle" | "walking" | "arrived";
  idleUntil: number;
  timer: number;
  nextDest: [number, number, number];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const WALL_HEIGHT = 10;
const ROOM_WIDTH = 24;
const ROOM_DEPTH = 20;
const MOVE_SPEED = 1.5;          // units/sec
const ARRIVE_THRESHOLD = 0.3;
const COLLISION_RADIUS = 0.8;
const REPULSION_RADIUS = 1.5;
const REPULSION_FORCE = 0.06;

const POIS: [number, number, number][] = [
  [-10.9, 0, -6],    // Server rack
  [9, 1.37, -8.6],   // Coffee counter top
  [9.5, 0.75, 6.3],  // TV lounge sofa
  [-8, 0.76, -7.5],  // Ping pong
  [0, 0.8, 0],       // War room table
  [0, 3.5, -8.5],    // Whiteboard
  [-9, 0, -6],       // Lucas desk
  [9, 0, -6],        // Noah desk
];

const AGENTS_META: AgentData[] = [
  { name: "Ethan",   emoji: "👑", color: "#8b5cf6", role: "Team Lead",   pos: [0, 0, -8]   },
  { name: "Lucas",   emoji: "🔨", color: "#3b82f6", role: "Builder",     pos: [-9, 0, -6]  },
  { name: "Sophia",  emoji: "✍️", color: "#10b981", role: "Content",     pos: [-9, 0, 4]   },
  { name: "Noah",   emoji: "🔭", color: "#f59e0b", role: "Research",     pos: [9, 0, -6]   },
  { name: "Michael", emoji: "🧪", color: "#ef4444", role: "QA",           pos: [9, 0, 4]    },
  { name: "Olivia",  emoji: "💼", color: "#f97316", role: "Brand",        pos: [-4, 0, 8.5] },
  { name: "William", emoji: "⚙️", color: "#6366f1", role: "Ops",          pos: [4, 0, 8.5]  },
];

// ─── Shared registry (module-level, shared across all agent instances) ────────
const globalPositions: THREE.Vector3[] = AGENTS_META.map(a => new THREE.Vector3(...a.pos));

// ─── Agent global state ───────────────────────────────────────────────────────
const agentStates: AgentGlobalState[] = AGENTS_META.map((a) => ({
  position: new THREE.Vector3(...a.pos),
  target: new THREE.Vector3(...a.pos),
  state: "idle" as const,
  idleUntil: 0,
  timer: Math.random() * 5 + 2,
  nextDest: new THREE.Vector3(...a.pos).toArray() as [number,number,number],
}));

// ─── Status colors ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  working: "#10b981",
  idle: "#f59e0b",
  "on-break": "#3b82f6",
};
const STATUS_LABEL: Record<string, string> = {
  working: "🟢 Working",
  idle: "🟡 Idle",
  "on-break": "🔵 On Break",
};
const HAIR_COLORS: Record<string, string> = {
  Ethan: "#4a1a7a", Lucas: "#1a3a7a", Sophia: "#0a5a3a",
  Noah: "#7a5a10", Michael: "#7a1a1a", Olivia: "#7a4a10", William: "#3a3a7a",
};
const SKIN_COLOR = "#D4956A";

// ─── Agent desk ──────────────────────────────────────────────────────────────
function AgentDesk({ position, agent }: {
  position: [number, number, number];
  agent: AgentData;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.08, 1.2]} />
        <meshStandardMaterial color="#3d3d5c" />
      </mesh>
      {[[-1.1,0,-0.5],[1.1,0,-0.5],[-1.1,0,0.5],[1.1,0,0.5]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]} castShadow>
          <boxGeometry args={[0.06,0.72,0.06]} />
          <meshStandardMaterial color="#2a2a3d" />
        </mesh>
      ))}
      <mesh position={[0,1.05,-0.1]} castShadow>
        <boxGeometry args={[0.1,0.3,0.1]} />
        <meshStandardMaterial color="#2a2a3d" />
      </mesh>
      <mesh position={[0,1.3,-0.1]} castShadow>
        <boxGeometry args={[1.0,0.65,0.05]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
      <mesh position={[0,1.3,-0.07]}>
        <planeGeometry args={[0.9,0.55]} />
        <meshStandardMaterial color={agent.color} emissive={new THREE.Color(agent.color)} emissiveIntensity={0.8} />
      </mesh>
      <Text position={[0,1.75,-0.1]} fontSize={0.25} color={agent.color} anchorX="center" anchorY="middle">
        {agent.emoji} {agent.name}
      </Text>
      <Text position={[0,1.92,-0.1]} fontSize={0.14} color="#9ca3af" anchorX="center" anchorY="middle">
        {agent.role}
      </Text>
    </group>
  );
}

// ─── Minecraft Agent ──────────────────────────────────────────────────────────
function MinecraftAgent({
  agentIdx, agentData, onSelect, isSelected
}: {
  agentIdx: number;
  agentData: AgentData;
  onSelect: (idx: number) => void;
  isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Mesh>(null);
  const legLRef = useRef<THREE.Mesh>(null);
  const legRRef = useRef<THREE.Mesh>(null);

  const state = agentStates[agentIdx];
  const hairColor = HAIR_COLORS[agentData.name] ?? "#333333";

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const now = clock.elapsedTime;
    const pos = globalPositions[agentIdx];

    // ── State machine ─────────────────────────────────────────────────────────
    if (state.state === "idle" || state.state === "arrived") {
      if (now >= state.idleUntil) {
        // Pick new destination
        const r = Math.random();
        if (r < 0.4) {
          // Random floor spot
          state.nextDest = [
            (Math.random() - 0.5) * 18,
            0,
            (Math.random() - 0.5) * 16,
          ];
        } else if (r < 0.8) {
          // POI
          const poi = POIS[Math.floor(Math.random() * POIS.length)];
          state.nextDest = [...poi] as [number,number,number];
        } else {
          // Back to desk
          state.nextDest = [...AGENTS_META[agentIdx].pos] as [number,number,number];
        }
        state.target.set(...state.nextDest);
        state.state = "walking";
      }
    }

    if (state.state === "walking") {
      const dir = state.target.clone().sub(pos);
      const dist = dir.length();

      // ── Collision avoidance ────────────────────────────────────────────────
      const repulsion = new THREE.Vector3();
      for (let j = 0; j < globalPositions.length; j++) {
        if (j === agentIdx) continue;
        const diff = pos.clone().sub(globalPositions[j]);
        const d = diff.length();
        if (d < REPULSION_RADIUS && d > 0.01) {
          repulsion.addScaledVector(diff.normalize(), (REPULSION_RADIUS - d) * REPULSION_FORCE);
        }
      }

      if (dist < ARRIVE_THRESHOLD) {
        state.state = "arrived";
        state.idleUntil = now + 2 + Math.random() * 2;
        state.position.copy(state.target);
      } else {
        const step = MOVE_SPEED * delta;
        if (step < dist) {
          dir.normalize().multiplyScalar(step).add(repulsion);
          state.position.add(dir);
        } else {
          state.position.copy(state.target);
        }
      }
    }

    // ── Apply position to mesh ───────────────────────────────────────────────
    groupRef.current.position.copy(state.position);

    // ── Face direction of movement ───────────────────────────────────────────
    const targetDir = state.target.clone().sub(pos);
    if (targetDir.length() > 0.1) {
      groupRef.current.rotation.y = Math.atan2(targetDir.x, targetDir.z);
    }

    // ── Limb swing animation ─────────────────────────────────────────────────
    const moving = state.state === "walking";
    const swing = moving ? Math.sin(now * 6) * 0.4 : 0;
    const legSwing = moving ? -Math.sin(now * 6) * 0.35 : 0;
    const bob = moving ? 0 : Math.sin(now * 1.2) * 0.02; // idle bob

    if (armLRef.current) armLRef.current.rotation.x = swing;
    if (armRRef.current) armRRef.current.rotation.x = -swing;
    if (legLRef.current) legLRef.current.rotation.x = legSwing;
    if (legRRef.current) legRRef.current.rotation.x = -legSwing;

    // Apply idle bob to entire group
    if (groupRef.current) {
      groupRef.current.position.y = state.position.y + (moving ? 0 : bob);
    }
  });

  return (
    <group
      ref={groupRef}
      position={agentData.pos}
      onClick={(e) => { e.stopPropagation(); onSelect(agentIdx); }}
    >
      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.7, 32]} />
          <meshStandardMaterial color={agentData.color} emissive={new THREE.Color(agentData.color)} emissiveIntensity={1} />
        </mesh>
      )}

      {/* Head */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={SKIN_COLOR} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <boxGeometry args={[0.52, 0.15, 0.52]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 1.85, 0.26]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.1, 1.85, 0.26]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Body */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.6, 0.7, 0.3]} />
        <meshStandardMaterial color={agentData.color} />
      </mesh>
      {/* Left Arm */}
      <mesh ref={armLRef} position={[-0.45, 1.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.65, 0.2]} />
        <meshStandardMaterial color={agentData.color} />
      </mesh>
      {/* Right Arm */}
      <mesh ref={armRRef} position={[0.45, 1.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.65, 0.2]} />
        <meshStandardMaterial color={agentData.color} />
      </mesh>
      {/* Left Leg */}
      <mesh ref={legLRef} position={[-0.15, 0.65, 0]} castShadow>
        <boxGeometry args={[0.25, 0.55, 0.25]} />
        <meshStandardMaterial color={agentData.color} />
      </mesh>
      {/* Right Leg */}
      <mesh ref={legRRef} position={[0.15, 0.65, 0]} castShadow>
        <boxGeometry args={[0.25, 0.55, 0.25]} />
        <meshStandardMaterial color={agentData.color} />
      </mesh>
      {/* Name tag */}
      <Text position={[0, 2.6, 0]} fontSize={0.2} color={agentData.color} anchorX="center" anchorY="middle">
        {agentData.emoji} {agentData.name}
      </Text>
      <Text position={[0, 2.38, 0]} fontSize={0.12} color="#9ca3af" anchorX="center" anchorY="middle">
        {agentData.role}
      </Text>
    </group>
  );
}

// ─── Agent Info Popup (HTML overlay) ─────────────────────────────────────────
function AgentPopup({ agentIdx, onClose }: { agentIdx: number; onClose: () => void }) {
  const agent = AGENTS_META[agentIdx];
  const state = agentStates[agentIdx];
  const status = state.state === "walking" ? "working" : state.state === "arrived" ? "idle" : "idle";

  // Load task data
  const [taskInfo, setTaskInfo] = useState<{ current: string; completed: number }>({ current: "No active task", completed: 0 });
  useEffect(() => {
    fetch("/api/tasks")
      .then(r => r.json())
      .then((tasks: { agent: string; status: string; title: string }[]) => {
        const agentTasks = tasks.filter(t => t.agent === agent.name);
        const inProgress = agentTasks.find(t => t.status === "in-progress");
        const completed = agentTasks.filter(t => t.status === "completed").length;
        setTaskInfo({ current: inProgress?.title ?? "No active task", completed });
      })
      .catch(() => setTaskInfo({ current: "No active task", completed: 0 }));
  }, [agent.name]);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 50,
        background: "rgba(17,17,39,0.95)",
        backdropFilter: "blur(16px)",
        border: `2px solid ${agent.color}60`,
        borderRadius: "16px",
        padding: "24px",
        width: "300px",
        boxShadow: `0 0 40px ${agent.color}40`,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 12, right: 12,
          background: "transparent", border: "none", color: "#9ca3af",
          cursor: "pointer", fontSize: "18px",
        }}
      >
        ✕
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: `${agent.color}20`, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "24px", border: `1px solid ${agent.color}40`,
        }}>
          {agent.emoji}
        </div>
        <div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{agent.name}</div>
          <div style={{ fontSize: "13px", color: agent.color }}>{agent.role}</div>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>STATUS</div>
        <span style={{
          fontSize: "12px", padding: "3px 10px", borderRadius: "20px",
          background: `${STATUS_COLOR[status]}20`, color: STATUS_COLOR[status],
        }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Current task */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>CURRENT TASK</div>
        <div style={{ fontSize: "13px", color: "#fff" }}>{taskInfo.current}</div>
      </div>

      {/* Completed */}
      <div>
        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>COMPLETED</div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#10b981" }}>{taskInfo.completed}</div>
      </div>
    </div>
  );
}

// ─── Header Bar ───────────────────────────────────────────────────────────────
function HeaderBar({ working, idle, onBreak }: { working: number; idle: number; onBreak: number }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      height: "56px",
      background: "rgba(10,10,20,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid #1e1e3a",
      display: "flex", alignItems: "center",
      padding: "0 24px", gap: "24px",
      zIndex: 20,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px" }}>🏢</span>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
          Kailash Command
        </span>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>— Team Office</span>
      </div>

      <div style={{ display: "flex", gap: "16px", marginLeft: "auto" }}>
        <span style={{ fontSize: "12px", color: "#10b981" }}>🟢 Working {working}</span>
        <span style={{ fontSize: "12px", color: "#f59e0b" }}>🟡 Idle {idle}</span>
        <span style={{ fontSize: "12px", color: "#3b82f6" }}>🔵 On Break {onBreak}</span>
      </div>

      <div style={{
        background: "#8b5cf6", borderRadius: "20px",
        padding: "2px 10px", fontSize: "12px", fontWeight: 600, color: "#fff",
      }}>
        {working + idle + onBreak} agents
      </div>
    </div>
  );
}

// ─── Office Room ─────────────────────────────────────────────────────────────
function OfficeRoom() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color="#F5F0E8" />
      </mesh>
      <gridHelper args={[Math.max(ROOM_WIDTH, ROOM_DEPTH), 24, "#d4cfc5", "#d4cfc5"]} position={[0, 0.01, 0]} />
      <mesh position={[0, WALL_HEIGHT / 2, -ROOM_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
      <mesh position={[-ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
      <mesh position={[ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
    </group>
  );
}

// ─── Label ───────────────────────────────────────────────────────────────────
function Label3D({ position, children, color = "#ffffff", fontSize = 0.6 }: {
  position: [number, number, number]; children: React.ReactNode; color?: string; fontSize?: number;
}) {
  return (
    <Text position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle">
      {children}
    </Text>
  );
}

// ─── War Room ────────────────────────────────────────────────────────────────
function WarRoom() {
  const glassMat = { color: "#8b5cf6", transparent: true, opacity: 0.13, side: 2 } as const;
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 2.2, 3.8]}><planeGeometry args={[8, 4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[0, 2.2, -3.8]} rotation={[0, Math.PI, 0]}><planeGeometry args={[8, 4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[-3.8, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[7.6, 4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[3.8, 2.2, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[7.6, 4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow><cylinderGeometry args={[2.2, 2.2, 0.1, 32]} /><meshStandardMaterial color="#2d2d4a" /></mesh>
      <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.15, 0.15, 0.6, 8]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      {[0,1,2,3,4,5,6,7].map(i => {
        const a = (i/8)*Math.PI*2, r=3.0;
        return (
          <group key={i} position={[Math.sin(a)*r, 0, Math.cos(a)*r]} rotation={[0,-a,0]}>
            <mesh position={[0,0.5,0]} castShadow><boxGeometry args={[0.6,0.08,0.6]} /><meshStandardMaterial color="#3d3d5c" /></mesh>
            <mesh position={[0,0.9,-0.25]} castShadow><boxGeometry args={[0.6,0.7,0.08]} /><meshStandardMaterial color="#3d3d5c" /></mesh>
            {[[-0.25,0,-0.25],[0.25,0,-0.25],[-0.25,0,0.25],[0.25,0,0.25]].map(([x,y,z],j) => (
              <mesh key={j} position={[x,y,z]} castShadow><cylinderGeometry args={[0.03,0.03,0.5,6]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
            ))}
          </group>
        );
      })}
      <Label3D position={[0, 5.2, 3.85]} color="#8b5cf6" fontSize={0.7}>WAR ROOM</Label3D>
    </group>
  );
}

// ─── Server Rack ─────────────────────────────────────────────────────────────
function ServerRack({ position }: { position: [number, number, number] }) {
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    ledRefs.current.forEach((led) => {
      if (!led || !(led.material instanceof THREE.MeshStandardMaterial)) return;
      if (Math.random() > 0.85) {
        led.material.emissiveIntensity = 2;
        led.material.color.set(Math.random() > 0.5 ? "#00ff88" : "#ff8800");
        led.material.emissive.set(led.material.color);
      } else {
        led.material.emissiveIntensity = 0.2;
      }
    });
  });
  const ledColors = ["#00ff88", "#ff8800"];
  return (
    <group position={position}>
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow><boxGeometry args={[1.2, 5, 0.8]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      {[-1.5,-0.5,0.5,1.5].map((y, ri) =>
        [-0.35,-0.15,0.05,0.25,0.4].map((x, ci) => {
          const col = ledColors[(ri+ci)%2];
          return (
            <mesh key={`${ri}-${ci}`} position={[x, 2.5+y, 0.45]} ref={(el: THREE.Mesh | null) => { ledRefs.current[ri*5+ci] = el; }}>
              <boxGeometry args={[0.06,0.06,0.02]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} />
            </mesh>
          );
        })
      )}
      <Label3D position={[0, 5.5, 0.4]} color="#00ff88" fontSize={0.5}>AI BRAIN</Label3D>
    </group>
  );
}

// ─── Coffee Station ───────────────────────────────────────────────────────────
function CoffeeStation({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0,0.9,0]} castShadow receiveShadow><boxGeometry args={[2.0,0.9,0.8]} /><meshStandardMaterial color="#4a3728" /></mesh>
      <mesh position={[0,1.37,0]} castShadow receiveShadow><boxGeometry args={[2.1,0.06,0.9]} /><meshStandardMaterial color="#5c4433" /></mesh>
      <mesh position={[-0.4,1.85,0]} castShadow><boxGeometry args={[0.6,0.9,0.6]} /><meshStandardMaterial color="#2a2a3d" /></mesh>
      <mesh position={[-0.4,2.35,0.31]}><boxGeometry args={[0.5,0.3,0.02]} /><meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} /></mesh>
      {[0.3,0.55,0.8].map((x,i) => (
        <mesh key={i} position={[x,1.44,0.1]} castShadow><cylinderGeometry args={[0.08,0.06,0.15,12]} /><meshStandardMaterial color="#e8d5c4" /></mesh>
      ))}
      <Label3D position={[0, 2.9, 0.4]} color="#c4813a" fontSize={0.45}>FUEL STATION ☕</Label3D>
    </group>
  );
}

// ─── TV Lounge ───────────────────────────────────────────────────────────────
function TVLounge({ position }: { position: [number, number, number] }) {
  const tvRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (tvRef.current && tvRef.current.material instanceof THREE.MeshStandardMaterial) {
      tvRef.current.material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
    }
  });
  return (
    <group position={position}>
      <mesh position={[0,3.5,-0.05]} ref={tvRef}><boxGeometry args={[3.5,2.0,0.06]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.4} /></mesh>
      <mesh position={[-1.2,0.45,1.5]} castShadow receiveShadow><boxGeometry args={[2.0,0.5,0.8]} /><meshStandardMaterial color="#1e40af" /></mesh>
      <mesh position={[-1.2,0.85,1.1]} castShadow><boxGeometry args={[2.0,0.7,0.15]} /><meshStandardMaterial color="#1e3a8a" /></mesh>
      <mesh position={[1.2,0.45,1.5]} castShadow receiveShadow><boxGeometry args={[2.0,0.5,0.8]} /><meshStandardMaterial color="#4c1d95" /></mesh>
      <mesh position={[1.2,0.85,1.1]} castShadow><boxGeometry args={[2.0,0.7,0.15]} /><meshStandardMaterial color="#3b0764" /></mesh>
      <mesh position={[0,0.35,2.5]} castShadow receiveShadow><cylinderGeometry args={[0.7,0.7,0.08,24]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      <mesh position={[0,0.15,2.5]} castShadow><cylinderGeometry args={[0.08,0.08,0.3,8]} /><meshStandardMaterial color="#111122" /></mesh>
      <Label3D position={[0, 5.0, -0.1]} color="#3b82f6" fontSize={0.6}>CHILL ZONE</Label3D>
    </group>
  );
}

// ─── Table Tennis ────────────────────────────────────────────────────────────
function TableTennis({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0,0.76,0]} castShadow receiveShadow><boxGeometry args={[4.0,0.1,2.0]} /><meshStandardMaterial color="#166534" /></mesh>
      <mesh position={[0,0.82,0]}><planeGeometry args={[0.05,1.8]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0,0.82,0]}><planeGeometry args={[3.8,0.04]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0,1.1,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[3.8,0.4]} /><meshStandardMaterial color="#e5e7eb" transparent opacity={0.7} /></mesh>
      {[-1.9,1.9].map((x,i) => (
        <mesh key={i} position={[x,0.95,0]} castShadow><cylinderGeometry args={[0.04,0.04,0.55,8]} /><meshStandardMaterial color="#374151" /></mesh>
      ))}
      {[[1.5,0.85,0.6],[1.7,0.85,-0.5],[1.6,0.85,0.2]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]} castShadow><sphereGeometry args={[0.08,12,12]} /><meshStandardMaterial color="#f5f5f5" /></mesh>
      ))}
      <Label3D position={[0, 1.7, 0]} color="#166534" fontSize={0.45}>GAME ZONE 🏓</Label3D>
    </group>
  );
}

// ─── Bookshelf ────────────────────────────────────────────────────────────────
const BOOK_COLORS = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];
function Bookshelf({ position }: { position: [number, number, number] }) {
  const books: {x:number;y:number;col:string}[] = [];
  let bx=-0.9, by=0, row=0;
  while (row < 4) {
    const h=0.5+Math.random()*0.3, w=0.08+Math.random()*0.06;
    books.push({x:bx+w/2, y:by+h/2, col:BOOK_COLORS[Math.floor(Math.random()*BOOK_COLORS.length)]});
    bx += w+0.02;
    if (bx > 0.9) { bx=-0.9; by+=0.7; row++; }
  }
  return (
    <group position={position}>
      <mesh position={[0,1.5,0]} castShadow receiveShadow><boxGeometry args={[2.2,3.0,0.4]} /><meshStandardMaterial color="#5c3d2e" /></mesh>
      {[0,0.7,1.4,2.1].map(y => (
        <mesh key={y} position={[0,y,0.05]} receiveShadow><boxGeometry args={[2.1,0.05,0.35]} /><meshStandardMaterial color="#7a5240" /></mesh>
      ))}
      {books.map((b,i) => (
        <mesh key={i} position={[b.x,b.y,0]} castShadow><boxGeometry args={[0.13,b.y*2,0.25]} /><meshStandardMaterial color={b.col} /></mesh>
      ))}
    </group>
  );
}

// ─── Whiteboard ──────────────────────────────────────────────────────────────
function Whiteboard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow><boxGeometry args={[4.5,3.0,0.06]} /><meshStandardMaterial color="#f0f0f0" /></mesh>
      <mesh position={[0,0,-0.04]} castShadow><boxGeometry args={[4.7,3.2,0.04]} /><meshStandardMaterial color="#374151" /></mesh>
      {[-0.6,-0.2,0.2,0.6].map((y,i) => (
        <mesh key={i} position={[0,y,0.04]}><planeGeometry args={[3.5+i*0.1,0.03]} /><meshStandardMaterial color="#8b5cf6" /></mesh>
      ))}
      <Label3D position={[0, 1.8, 0.1]} color="#8b5cf6" fontSize={0.4}>TASKS</Label3D>
    </group>
  );
}

// ─── Plant ───────────────────────────────────────────────────────────────────
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0,0.25,0]} castShadow receiveShadow><cylinderGeometry args={[0.25,0.2,0.5,12]} /><meshStandardMaterial color="#7c3aed" /></mesh>
      <mesh position={[0,0.75,0]} castShadow><sphereGeometry args={[0.35,12,12]} /><meshStandardMaterial color="#16a34a" /></mesh>
      <mesh position={[0,0.6,0]} castShadow><cylinderGeometry args={[0.03,0.03,0.4,6]} /><meshStandardMaterial color="#15803d" /></mesh>
    </group>
  );
}

// ─── Ceiling Lights ───────────────────────────────────────────────────────────
function CeilingLights() {
  const positions: [number,number,number][] = [[-6,9.4,-4],[0,9.4,-4],[6,9.4,-4],[-6,9.4,4],[0,9.4,4],[6,9.4,4]];
  return (
    <>
      {positions.map((pos,i) => (
        <group key={i} position={pos}>
          <mesh><boxGeometry args={[1.2,0.12,0.5]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
          <pointLight position={[0,-0.3,0]} intensity={0.5} color="#fffbe6" distance={6} />
        </group>
      ))}
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ selectedAgent, onSelectAgent }: {
  selectedAgent: number | null;
  onSelectAgent: (idx: number | null) => void;
}) {
  // Count walking agents for stats
  const walkingCount = agentStates.filter(s => s.state === "walking").length;
  const idleCount = agentStates.filter(s => s.state === "idle" || s.state === "arrived").length;

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 30, 60]} />
      <OfficeRoom />

      {/* Desks */}
      {AGENTS_META.map(a => <AgentDesk key={a.name} agent={a} position={a.pos} />)}

      {/* Agents — click to select */}
      {AGENTS_META.map((a, i) => (
        <MinecraftAgent
          key={a.name}
          agentIdx={i}
          agentData={a}
          onSelect={onSelectAgent}
          isSelected={selectedAgent === i}
        />
      ))}

      <WarRoom />
      <ServerRack position={[-10.9, 0, -6]} />
      <CoffeeStation position={[9, 0, -8.6]} />
      <TVLounge position={[9.5, 0, 5.5]} />
      <TableTennis position={[-8, 0, -7.5]} />
      <Bookshelf position={[11.4, 0, -4]} />
      <Whiteboard position={[0, 3.5, -9.7]} />
      <Plant position={[-11, 0, -9]} />
      <Plant position={[11, 0, -9]} />
      <Plant position={[-11, 0, 9]} />
      <Plant position={[11, 0, 9]} />
      <CeilingLights />

      <ambientLight intensity={0.35} color="#ffffff" />
      <directionalLight position={[10, 15, -5]} intensity={0.6} color="#fff5e6" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-6,8,-4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[6,8,-4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[-6,8,4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[6,8,4]} intensity={0.25} color="#fff5e6" />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={8}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Office3D() {
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const walkingCount = agentStates.filter(s => s.state === "walking").length;
  const idleCount = agentStates.filter(s => s.state === "idle" || s.state === "arrived").length;

  const handleSelect = useCallback((idx: number | null) => {
    setSelectedAgent(idx);
  }, []);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      onClick={() => setSelectedAgent(null)}
    >
      <HeaderBar working={walkingCount} idle={idleCount} onBreak={0} />

      <Canvas
        shadows
        camera={{ position: [0, 18, 14], fov: 50 }}
        style={{ width: "100%", height: "100%", paddingTop: "56px" }}
        onClick={() => setSelectedAgent(null)}
      >
        <Suspense fallback={null}>
          <Scene selectedAgent={selectedAgent} onSelectAgent={handleSelect} />
        </Suspense>
      </Canvas>

      {selectedAgent !== null && (
        <AgentPopup agentIdx={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}

      {/* Legend overlay */}
      <div style={{
        position: "absolute", bottom: 20, left: 24,
        display: "flex", gap: "16px",
        fontFamily: "system-ui, sans-serif",
      }}>
        {[
          { label: "Walking", color: "#8b5cf6" },
          { label: "At POI", color: "#f59e0b" },
          { label: "Idle", color: "#6b7280" },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
