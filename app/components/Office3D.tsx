"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Suspense, useRef, useState, useEffect } from "react";
import * as THREE from "three";

// ─── Types ───────────────────────────────────────────────────────────────────
type AgentData = {
  name: string; emoji: string; color: string; role: string;
  pos: [number, number, number];
};
type AgentLocalState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  state: "idle" | "walking" | "arrived";
  idleUntil: number;  // wall-clock time (seconds) when idle ends. -1 = not started
  walkStarted: boolean; // whether this agent has started walking at least once
};

// ─── Constants ────────────────────────────────────────────────────────────────
const MOVE_SPEED      = 2.0;      // units per second
const ARRIVE_DIST     = 0.45;    // distance at which agent stops
const REPEL_RADIUS    = 1.2;     // repulsion interaction radius
const REPEL_STRENGTH  = 0.08;   // repulsion force multiplier

// Inner boundary
const BX1 = -11.0, BX2 = 11.0;
const BZ1 = -9.0,  BZ2 =  9.0;

const POIS: [number, number, number][] = [
  [-10.9, 0, -6],  // Server rack
  [ 9.0,  0, -8.6], // Coffee counter
  [ 9.5,  0,  6.3], // TV lounge
  [ -8.0, 0, -7.5], // Ping pong
  [  0.0, 0,  0.0], // War room table
];

const AGENTS_META: AgentData[] = [
  { name: "Ethan",   emoji: "👑", color: "#8b5cf6", role: "Team Lead",  pos: [  0, 0, -8] },
  { name: "Lucas",   emoji: "🔨", color: "#3b82f6", role: "Builder",    pos: [ -9, 0, -6] },
  { name: "Sophia",  emoji: "✍️", color: "#10b981", role: "Content",    pos: [ -9, 0,  4] },
  { name: "Noah",   emoji: "🔭", color: "#f59e0b", role: "Research",   pos: [  9, 0, -6] },
  { name: "Michael", emoji: "🧪", color: "#ef4444", role: "QA",         pos: [  9, 0,  4] },
  { name: "Olivia",  emoji: "💼", color: "#f97316", role: "Brand",      pos: [ -4, 0,  8] },
  { name: "William", emoji: "⚙️", color: "#6366f1", role: "Ops",         pos: [  4, 0,  8] },
];

// Randomise initial agent positions across the floor (scattered, not clustered at desks)
function randomStartPos(index: number): [number, number, number] {
  const seeds: [number, number, number][] = [
    [-4, 0, -3], [ 4, 0,  3], [-7, 0,  1], [ 7, 0, -1],
    [ 1, 0, -5], [-2, 0,  5], [ 5, 0, -6], [-6, 0,  4],
  ];
  return seeds[index] ?? [
    (Math.random() - 0.5) * 16,
    0,
    (Math.random() - 0.5) * 12,
  ];
}

// Module-level shared positions — used for repulsion calculations across all agent instances
const sharedPos: THREE.Vector3[] = AGENTS_META.map((_, i) => new THREE.Vector3(...randomStartPos(i)));

// Per-agent local state
const agentState: AgentLocalState[] = AGENTS_META.map((a, i) => {
  const start = randomStartPos(i);
  return {
    position:    new THREE.Vector3(...start),
    target:      new THREE.Vector3(...start),
    velocity:    new THREE.Vector3(),
    state:       "idle",
    idleUntil:   -1,
    walkStarted: false,
  };
});

// ─── Furniture boxes (solid, agents avoid) ────────────────────────────────────
const FURNITURE: { min: THREE.Vector3; max: THREE.Vector3 }[] = [
  { min: new THREE.Vector3(-3.8, 0, -3.8), max: new THREE.Vector3( 3.8, 4.4,  3.8) }, // War room
  { min: new THREE.Vector3(-11.5, 0, -9),  max: new THREE.Vector3(-10.3, 5, -5.2) }, // Server rack
  { min: new THREE.Vector3(  8.0, 0, -9.2),max: new THREE.Vector3(10.0, 3, -8.0) }, // Coffee counter
  { min: new THREE.Vector3(  8.0, 0,  5.0),max: new THREE.Vector3(11.0, 4.5, 7.0) }, // TV lounge
  { min: new THREE.Vector3(-10.0, 0, -9.5),max: new THREE.Vector3(-6.0, 3, -5.5) }, // Ping pong
  // Desks
  { min: new THREE.Vector3(-2.2, 0, -8.8), max: new THREE.Vector3( 2.2, 2, -7.2) }, // Ethan
  { min: new THREE.Vector3(-10.2, 0, -7.2),max:new THREE.Vector3(-7.8, 2, -4.8) }, // Lucas
  { min: new THREE.Vector3(-10.2, 0, 3.2), max:new THREE.Vector3(-7.8, 2,  5.6) }, // Sophia
  { min: new THREE.Vector3( 7.8, 0, -7.2), max:new THREE.Vector3(10.2, 2, -4.8) }, // Noah
  { min: new THREE.Vector3( 7.8, 0,  3.2), max:new THREE.Vector3(10.2, 2,  5.6) }, // Michael
  { min: new THREE.Vector3(-5.2, 0,  7.8), max:new THREE.Vector3(-2.8, 2,  9.2) }, // Olivia
  { min: new THREE.Vector3( 2.8, 0,  7.8), max:new THREE.Vector3( 5.2, 2,  9.2) }, // William
];

function isBlocked(p: THREE.Vector3): boolean {
  for (const b of FURNITURE) {
    if (p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z) return true;
  }
  return false;
}

function pickDestination(agentIdx: number): THREE.Vector3 {
  for (let attempt = 0; attempt < 40; attempt++) {
    let dest: THREE.Vector3;
    const roll = Math.random();

    if (roll < 0.35) {
      // Random floor point
      dest = new THREE.Vector3(
        BX1 + 1 + Math.random() * (BX2 - BX1 - 2),
        0,
        BZ1 + 1 + Math.random() * (BZ2 - BZ1 - 2)
      );
    } else if (roll < 0.75) {
      // POI
      const poi = POIS[Math.floor(Math.random() * POIS.length)];
      dest = new THREE.Vector3(poi[0], 0, poi[2]);
    } else {
      // Near desk of a random agent
      const deskOf = AGENTS_META[Math.floor(Math.random() * AGENTS_META.length)].pos;
      dest = new THREE.Vector3(
        deskOf[0] + (Math.random() - 0.5) * 3,
        0,
        deskOf[2] + (Math.random() - 0.5) * 3
      );
    }

    if (!isBlocked(dest) &&
        dest.x > BX1 && dest.x < BX2 &&
        dest.z > BZ1 && dest.z < BZ2) {
      return dest;
    }
  }
  // Fallback — guaranteed free spot in centre
  return new THREE.Vector3(0, 0, 2);
}

const HAIR_COLORS: Record<string, string> = {
  Ethan:"#4a1a7a", Lucas:"#1a3a7a", Sophia:"#0a5a3a",
  Noah:"#7a5a10", Michael:"#7a1a1a", Olivia:"#7a4a10", William:"#3a3a7a",
};
const SKIN = "#D4956A";

// ─── Desk (visual only — no collision logic) ─────────────────────────────────
function AgentDesk({ position, agent }: { position: [number,number,number]; agent: AgentData }) {
  return (
    <group position={position}>
      <mesh position={[0,0.75,0]} castShadow receiveShadow>
        <boxGeometry args={[2.4,0.08,1.2]} />
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

// ─── Agent ────────────────────────────────────────────────────────────────────
function Agent({
  agentIdx, agentData, onSelect, isSelected
}: {
  agentIdx: number; agentData: AgentData;
  onSelect: (idx: number) => void; isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);

  const st      = agentState[agentIdx];
  const hairCol = HAIR_COLORS[agentData.name] ?? "#333";

  useFrame(({ clock }, dt) => {
    if (!groupRef.current) return;
    const now = clock.elapsedTime;
    const pos = st.position;

    // ── 1. Start countdown on first frame ────────────────────────────────────
    if (st.idleUntil < 0 && now > 0.1) {
      st.idleUntil = now + 3 + Math.random() * 6; // 3-9 sec delay before first walk
    }

    // ── 2. Transition: idle → walking ────────────────────────────────────────
    if (st.state === "idle" && now >= st.idleUntil) {
      st.target.copy(pickDestination(agentIdx));
      st.state = "walking";
    }

    // ── 3. Transition: arrived → next destination ───────────────────────────
    if (st.state === "arrived" && now >= st.idleUntil) {
      st.target.copy(pickDestination(agentIdx));
      st.state = "walking";
    }

    // ── 4. Walk ──────────────────────────────────────────────────────────────
    if (st.state === "walking") {
      const toGoal  = st.target.clone().sub(pos);
      const dist    = toGoal.length();

      // Arrived?
      if (dist < ARRIVE_DIST) {
        pos.copy(st.target);
        sharedPos[agentIdx].copy(st.target);
        groupRef.current.position.copy(pos);
        st.state     = "arrived";
        st.idleUntil = now + 2 + Math.random() * 3; // idle 2-5 s
        st.walkStarted = true;
        return;
      }

      // Normalise direction
      const dir = toGoal.divideScalar(dist); // dir = normalised toGoal

      // Repulsion from other agents
      const repel = new THREE.Vector3();
      for (let j = 0; j < sharedPos.length; j++) {
        if (j === agentIdx) continue;
        const diff = pos.clone().sub(sharedPos[j]);
        const d = diff.length();
        if (d < REPEL_RADIUS && d > 0.001) {
          const factor = (REPEL_RADIUS - d) / REPEL_RADIUS;
          repel.addScaledVector(diff.divideScalar(d), factor * REPEL_STRENGTH);
        }
      }

      // Combined movement
      const speed = Math.min(MOVE_SPEED * dt, dist);
      pos.addScaledVector(dir, speed);
      pos.add(repel);

      // Boundary clamp
      pos.x = Math.max(BX1, Math.min(BX2, pos.x));
      pos.z = Math.max(BZ1, Math.min(BZ2, pos.z));

      // Sync shared position for other agents' repulsion calculations
      sharedPos[agentIdx].copy(pos);

      // Apply to mesh
      groupRef.current.position.copy(pos);

      // Face direction of travel
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // ── 5. Idle bob ──────────────────────────────────────────────────────────
    if (!groupRef.current) return;
    if (st.state !== "walking") {
      groupRef.current.position.y = Math.sin(now * 1.5 + agentIdx * 0.9) * 0.025;
    }

    // ── 6. Limb animation ────────────────────────────────────────────────────
    const walking = st.state === "walking";
    const swing   = walking ? Math.sin(now * 5.5 + agentIdx) * 0.42 : 0;
    const lSwing  = walking ? -Math.sin(now * 5.5 + agentIdx) * 0.38 : 0;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.rotation.x = lSwing;
    if (legR.current) legR.current.rotation.x = -lSwing;
  });

  return (
    <group
      ref={groupRef}
      position={[st.position.x, st.position.y, st.position.z]}
      onClick={e => { e.stopPropagation(); onSelect(agentIdx); }}
    >
      {isSelected && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.52, 0.72, 32]} />
          <meshStandardMaterial color={agentData.color} emissive={new THREE.Color(agentData.color)} emissiveIntensity={1.2} />
        </mesh>
      )}

      {/* Head */}
      <mesh position={[0,1.8,0]} castShadow><boxGeometry args={[0.5,0.5,0.5]} /><meshStandardMaterial color={SKIN} /></mesh>
      {/* Hair */}
      <mesh position={[0,2.1,0]} castShadow><boxGeometry args={[0.52,0.15,0.52]} /><meshStandardMaterial color={hairCol} /></mesh>
      {/* Eyes */}
      <mesh position={[-0.1,1.85,0.26]}><boxGeometry args={[0.08,0.08,0.02]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[ 0.1,1.85,0.26]}><boxGeometry args={[0.08,0.08,0.02]} /><meshStandardMaterial color="#ffffff" /></mesh>
      {/* Body */}
      <mesh position={[0,1.15,0]} castShadow><boxGeometry args={[0.6,0.7,0.3]} /><meshStandardMaterial color={agentData.color} /></mesh>
      {/* Arms */}
      <mesh ref={armL} position={[-0.45,1.2,0]} castShadow><boxGeometry args={[0.2,0.65,0.2]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <mesh ref={armR} position={[ 0.45,1.2,0]} castShadow><boxGeometry args={[0.2,0.65,0.2]} /><meshStandardMaterial color={agentData.color} /></mesh>
      {/* Legs */}
      <mesh ref={legL} position={[-0.15,0.65,0]} castShadow><boxGeometry args={[0.25,0.55,0.25]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <mesh ref={legR} position={[ 0.15,0.65,0]} castShadow><boxGeometry args={[0.25,0.55,0.25]} /><meshStandardMaterial color={agentData.color} /></mesh>

      {/* Name */}
      <Text position={[0,2.62,0]} fontSize={0.2} color={agentData.color} anchorX="center" anchorY="middle">
        {agentData.emoji} {agentData.name}
      </Text>
      <Text position={[0,2.4,0]} fontSize={0.11} color="#9ca3af" anchorX="center" anchorY="middle">
        {agentData.role}
      </Text>
    </group>
  );
}

// ─── Popup ────────────────────────────────────────────────────────────────────
function AgentPopup({ agentIdx, onClose }: { agentIdx: number; onClose: () => void }) {
  const agent = AGENTS_META[agentIdx];
  const st    = agentState[agentIdx];
  const [taskInfo, setTaskInfo] = useState({ current: "Loading…", completed: 0 });

  useEffect(() => {
    fetch("/api/tasks")
      .then(r => r.json())
      .then((tasks: { agent: string; status: string; title: string }[]) => {
        const mine = tasks.filter(t => t.agent === agent.name);
        const active = mine.find(t => t.status === "in-progress");
        setTaskInfo({ current: active?.title ?? "No active task", completed: mine.filter(t => t.status === "completed").length });
      })
      .catch(() => setTaskInfo({ current: "No active task", completed: 0 }));
  }, [agent.name]);

  const isWorking = st.state === "walking";

  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
      zIndex: 50, background: "rgba(17,17,39,0.97)", backdropFilter: "blur(16px)",
      border: `2px solid ${agent.color}60`, borderRadius: "16px",
      padding: "24px", width: "300px", boxShadow: `0 0 40px ${agent.color}40`,
      color: "#fff", fontFamily: "system-ui, sans-serif",
    }}
      onClick={e => e.stopPropagation()}
    >
      <button onClick={onClose} style={{
        position:"absolute",top:12,right:12,background:"transparent",
        border:"none",color:"#9ca3af",cursor:"pointer",fontSize:"18px",
      }}>✕</button>
      <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
        <div style={{
          width:48,height:48,borderRadius:12,background:`${agent.color}20`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:24,border:`1px solid ${agent.color}40`,
        }}>{agent.emoji}</div>
        <div>
          <div style={{ fontSize:18,fontWeight:700,color:"#fff" }}>{agent.name}</div>
          <div style={{ fontSize:13,color:agent.color }}>{agent.role}</div>
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11,color:"#6b7280",marginBottom:4 }}>STATUS</div>
        <span style={{
          fontSize:12,padding:"3px 10px",borderRadius:20,
          background: isWorking ? "#10b98120" : "#f59e0b20",
          color: isWorking ? "#10b981" : "#f59e0b",
        }}>
          {isWorking ? "🟢 Working" : "🟡 Idle"}
        </span>
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11,color:"#6b7280",marginBottom:4 }}>CURRENT TASK</div>
        <div style={{ fontSize:13,color:"#fff" }}>{taskInfo.current}</div>
      </div>
      <div>
        <div style={{ fontSize:11,color:"#6b7280",marginBottom:4 }}>COMPLETED</div>
        <div style={{ fontSize:20,fontWeight:700,color:"#10b981" }}>{taskInfo.completed}</div>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function HeaderBar({ working, idle }: { working: number; idle: number }) {
  return (
    <div style={{
      position:"absolute",top:0,left:0,right:0,height:56,
      background:"rgba(10,10,20,0.88)",backdropFilter:"blur(12px)",
      borderBottom:"1px solid #1e1e3a",
      display:"flex",alignItems:"center",padding:"0 24px",gap:24,zIndex:20,
      fontFamily:"system-ui, sans-serif",
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        <span style={{ fontSize:20 }}>🏢</span>
        <span style={{ fontSize:16,fontWeight:700,color:"#fff" }}>Kailash Command</span>
        <span style={{ fontSize:13,color:"#6b7280" }}>— Team Office</span>
      </div>
      <div style={{ display:"flex",gap:16,marginLeft:"auto" }}>
        <span style={{ fontSize:12,color:"#10b981" }}>🟢 Working {working}</span>
        <span style={{ fontSize:12,color:"#f59e0b" }}>🟡 Idle {idle}</span>
      </div>
      <div style={{ background:"#8b5cf6",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600,color:"#fff" }}>
        {working+idle} agents
      </div>
    </div>
  );
}

// ─── Room ─────────────────────────────────────────────────────────────────────
function OfficeRoom() {
  const wm = { color:"#EEEADF", transparent:true, opacity:0.32, side:2 } as const;
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[24,20]} />
        <meshStandardMaterial color="#F5F0E8" />
      </mesh>
      <gridHelper args={[24,24,"#d4cfc5","#d4cfc5"]} position={[0,0.01,0]} />
      <mesh position={[0,5,-10]}><planeGeometry args={[24,10]} /><meshStandardMaterial {...wm} /></mesh>
      <mesh position={[0,5, 10]} rotation={[0,Math.PI,0]}><planeGeometry args={[24,10]} /><meshStandardMaterial {...wm} /></mesh>
      <mesh position={[-12,5,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[20,10]} /><meshStandardMaterial {...wm} /></mesh>
      <mesh position={[ 12,5,0]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[20,10]} /><meshStandardMaterial {...wm} /></mesh>
    </group>
  );
}

// ─── Label ───────────────────────────────────────────────────────────────────
function L({ pos, c="#fff", fs=0.6, ch }: { pos:[number,number,number]; c?:string; fs?:number; ch: React.ReactNode }) {
  return <Text position={pos} fontSize={fs} color={c} anchorX="center" anchorY="middle">{ch}</Text>;
}

// ─── War Room ────────────────────────────────────────────────────────────────
function WarRoom() {
  const gm = { color:"#8b5cf6", transparent:true, opacity:0.12, side:2 } as const;
  return (
    <group>
      <mesh position={[0,2.2,3.8]}><planeGeometry args={[8,4.4]} /><meshStandardMaterial {...gm} /></mesh>
      <mesh position={[0,2.2,-3.8]} rotation={[0,Math.PI,0]}><planeGeometry args={[8,4.4]} /><meshStandardMaterial {...gm} /></mesh>
      <mesh position={[-3.8,2.2,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[7.6,4.4]} /><meshStandardMaterial {...gm} /></mesh>
      <mesh position={[ 3.8,2.2,0]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[7.6,4.4]} /><meshStandardMaterial {...gm} /></mesh>
      <mesh position={[0,0.8,0]} castShadow receiveShadow><cylinderGeometry args={[2.2,2.2,0.1,32]} /><meshStandardMaterial color="#2d2d4a" /></mesh>
      <mesh position={[0,0.5,0]} castShadow><cylinderGeometry args={[0.15,0.15,0.6,8]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      {[0,1,2,3,4,5,6,7].map(i => {
        const a=(i/8)*Math.PI*2, r=3.0;
        return (
          <group key={i} position={[Math.sin(a)*r,0,Math.cos(a)*r]} rotation={[0,-a,0]}>
            <mesh position={[0,0.5,0]} castShadow><boxGeometry args={[0.6,0.08,0.6]} /><meshStandardMaterial color="#3d3d5c" /></mesh>
            <mesh position={[0,0.9,-0.25]} castShadow><boxGeometry args={[0.6,0.7,0.08]} /><meshStandardMaterial color="#3d3d5c" /></mesh>
          </group>
        );
      })}
      <L pos={[0,5.2,3.85]} c="#8b5cf6" fs={0.7} ch="WAR ROOM" />
    </group>
  );
}

// ─── Server Rack ─────────────────────────────────────────────────────────────
function ServerRack({ pos }: { pos:[number,number,number] }) {
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    ledRefs.current.forEach(led => {
      if (!led || !(led.material instanceof THREE.MeshStandardMaterial)) return;
      if (Math.random() > 0.85) {
        led.material.emissiveIntensity = 2;
        const c = Math.random() > 0.5 ? "#00ff88" : "#ff8800";
        led.material.color.set(c); led.material.emissive.set(c);
      } else {
        led.material.emissiveIntensity = 0.2;
      }
    });
  });
  return (
    <group position={pos}>
      <mesh position={[0,2.5,0]} castShadow receiveShadow><boxGeometry args={[1.2,5,0.8]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      {([-1.5,-0.5,0.5,1.5] as number[]).map((y,ri) =>
        ([-0.35,-0.15,0.05,0.25,0.4] as number[]).map((x,ci) => {
          const col = (ri+ci)%2===0 ? "#00ff88" : "#ff8800";
          return (
            <mesh key={`${ri}-${ci}`} position={[x,2.5+y,0.45]}
              ref={el => { if (ledRefs.current) ledRefs.current[ri*5+ci] = el; }}>
              <boxGeometry args={[0.06,0.06,0.02]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} />
            </mesh>
          );
        })
      )}
      <L pos={[0,5.5,0.4]} c="#00ff88" fs={0.5} ch="AI BRAIN" />
    </group>
  );
}

// ─── Coffee Station ─────────────────────────────────────────────────────────
function CoffeeStation({ pos }: { pos:[number,number,number] }) {
  return (
    <group position={pos}>
      <mesh position={[0,0.9,0]} castShadow receiveShadow><boxGeometry args={[2.0,0.9,0.8]} /><meshStandardMaterial color="#4a3728" /></mesh>
      <mesh position={[0,1.37,0]} castShadow receiveShadow><boxGeometry args={[2.1,0.06,0.9]} /><meshStandardMaterial color="#5c4433" /></mesh>
      <mesh position={[-0.4,1.85,0]} castShadow><boxGeometry args={[0.6,0.9,0.6]} /><meshStandardMaterial color="#2a2a3d" /></mesh>
      <mesh position={[-0.4,2.35,0.31]}><boxGeometry args={[0.5,0.3,0.02]} /><meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} /></mesh>
      {[0.3,0.55,0.8].map((x,i) => (
        <mesh key={i} position={[x,1.44,0.1]} castShadow><cylinderGeometry args={[0.08,0.06,0.15,12]} /><meshStandardMaterial color="#e8d5c4" /></mesh>
      ))}
      <L pos={[0,2.9,0.4]} c="#c4813a" fs={0.45} ch="FUEL STATION ☕" />
    </group>
  );
}

// ─── TV Lounge ───────────────────────────────────────────────────────────────
function TVLounge({ pos }: { pos:[number,number,number] }) {
  const tvRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (tvRef.current && tvRef.current.material instanceof THREE.MeshStandardMaterial)
      tvRef.current.material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime*1.5)*0.15;
  });
  return (
    <group position={pos}>
      <mesh position={[0,3.5,-0.05]} ref={tvRef}>
        <boxGeometry args={[3.5,2.0,0.06]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-1.2,0.45,1.5]} castShadow receiveShadow><boxGeometry args={[2.0,0.5,0.8]} /><meshStandardMaterial color="#1e40af" /></mesh>
      <mesh position={[-1.2,0.85,1.1]} castShadow><boxGeometry args={[2.0,0.7,0.15]} /><meshStandardMaterial color="#1e3a8a" /></mesh>
      <mesh position={[ 1.2,0.45,1.5]} castShadow receiveShadow><boxGeometry args={[2.0,0.5,0.8]} /><meshStandardMaterial color="#4c1d95" /></mesh>
      <mesh position={[ 1.2,0.85,1.1]} castShadow><boxGeometry args={[2.0,0.7,0.15]} /><meshStandardMaterial color="#3b0764" /></mesh>
      <mesh position={[0,0.35,2.5]} castShadow receiveShadow><cylinderGeometry args={[0.7,0.7,0.08,24]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      <mesh position={[0,0.15,2.5]} castShadow><cylinderGeometry args={[0.08,0.08,0.3,8]} /><meshStandardMaterial color="#111122" /></mesh>
      <L pos={[0,5.0,-0.1]} c="#3b82f6" fs={0.6} ch="CHILL ZONE" />
    </group>
  );
}

// ─── Table Tennis ─────────────────────────────────────────────────────────────
function TableTennis({ pos }: { pos:[number,number,number] }) {
  return (
    <group position={pos}>
      <mesh position={[0,0.76,0]} castShadow receiveShadow><boxGeometry args={[4.0,0.1,2.0]} /><meshStandardMaterial color="#166534" /></mesh>
      <mesh position={[0,0.82,0]}><planeGeometry args={[0.05,1.8]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0,0.82,0]}><planeGeometry args={[3.8,0.04]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0,1.1,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[3.8,0.4]} /><meshStandardMaterial color="#e5e7eb" transparent opacity={0.7} /></mesh>
      {([-1.9,1.9] as number[]).map((x,i) => (
        <mesh key={i} position={[x,0.95,0]} castShadow><cylinderGeometry args={[0.04,0.04,0.55,8]} /><meshStandardMaterial color="#374151" /></mesh>
      ))}
      {([[1.5,0.85,0.6],[1.7,0.85,-0.5],[1.6,0.85,0.2]] as [number,number,number][]).map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]} castShadow><sphereGeometry args={[0.08,12,12]} /><meshStandardMaterial color="#f5f5f5" /></mesh>
      ))}
      <L pos={[0,1.7,0]} c="#166534" fs={0.45} ch="GAME ZONE 🏓" />
    </group>
  );
}

// ─── Bookshelf ────────────────────────────────────────────────────────────────
const BKS = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];
function Bookshelf({ pos }: { pos:[number,number,number] }) {
  const books: {x:number;y:number;col:string;h:number}[] = [];
  let bx=-0.9, by=0, row=0;
  while (row < 4) {
    const h=0.5+Math.random()*0.3, w=0.08+Math.random()*0.06;
    books.push({x:bx+w/2, y:by+h/2, col:BKS[Math.floor(Math.random()*BKS.length)], h});
    bx += w+0.02;
    if (bx > 0.9) { bx=-0.9; by+=0.7; row++; }
  }
  return (
    <group position={pos}>
      <mesh position={[0,1.5,0]} castShadow receiveShadow><boxGeometry args={[2.2,3.0,0.4]} /><meshStandardMaterial color="#5c3d2e" /></mesh>
      {([0,0.7,1.4,2.1] as number[]).map(y => (
        <mesh key={y} position={[0,y,0.05]} receiveShadow><boxGeometry args={[2.1,0.05,0.35]} /><meshStandardMaterial color="#7a5240" /></mesh>
      ))}
      {books.map((b,i) => (
        <mesh key={i} position={[b.x,b.y,0]} castShadow><boxGeometry args={[0.13,b.h,0.25]} /><meshStandardMaterial color={b.col} /></mesh>
      ))}
    </group>
  );
}

// ─── Whiteboard ───────────────────────────────────────────────────────────────
function Whiteboard({ pos }: { pos:[number,number,number] }) {
  return (
    <group position={pos}>
      <mesh castShadow><boxGeometry args={[4.5,3.0,0.06]} /><meshStandardMaterial color="#f0f0f0" /></mesh>
      <mesh position={[0,0,-0.04]} castShadow><boxGeometry args={[4.7,3.2,0.04]} /><meshStandardMaterial color="#374151" /></mesh>
      {([-0.6,-0.2,0.2,0.6] as number[]).map((y,i) => (
        <mesh key={i} position={[0,y,0.04]}><planeGeometry args={[3.5+i*0.1,0.03]} /><meshStandardMaterial color="#8b5cf6" /></mesh>
      ))}
      <L pos={[0,1.8,0.1]} c="#8b5cf6" fs={0.4} ch="TASKS" />
    </group>
  );
}

// ─── Plant ───────────────────────────────────────────────────────────────────
function Plant({ pos }: { pos:[number,number,number] }) {
  return (
    <group position={pos}>
      <mesh position={[0,0.25,0]} castShadow receiveShadow><cylinderGeometry args={[0.25,0.2,0.5,12]} /><meshStandardMaterial color="#7c3aed" /></mesh>
      <mesh position={[0,0.75,0]} castShadow><sphereGeometry args={[0.35,12,12]} /><meshStandardMaterial color="#16a34a" /></mesh>
      <mesh position={[0,0.6,0]} castShadow><cylinderGeometry args={[0.03,0.03,0.4,6]} /><meshStandardMaterial color="#15803d" /></mesh>
    </group>
  );
}

// ─── Ceiling Lights ───────────────────────────────────────────────────────────
function CeilingLights() {
  const pts: [number,number,number][] = [[-6,9.4,-4],[0,9.4,-4],[6,9.4,-4],[-6,9.4,4],[0,9.4,4],[6,9.4,4]];
  return (
    <>
      {pts.map((p,i) => (
        <group key={i} position={p}>
          <mesh><boxGeometry args={[1.2,0.12,0.5]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
          <pointLight position={[0,-0.3,0]} intensity={0.5} color="#fffbe6" distance={6} />
        </group>
      ))}
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ selectedAgent, onSelectAgent }: {
  selectedAgent: number|null; onSelectAgent: (idx: number|null) => void;
}) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000",30,60]} />
      <OfficeRoom />
      {AGENTS_META.map(a => <AgentDesk key={a.name} agent={a} position={a.pos} />)}
      {AGENTS_META.map((a, i) => (
        <Agent key={a.name} agentIdx={i} agentData={a}
          onSelect={onSelectAgent} isSelected={selectedAgent===i} />
      ))}
      <WarRoom />
      <ServerRack pos={[-10.9,0,-6]} />
      <CoffeeStation pos={[9,0,-8.6]} />
      <TVLounge pos={[9.5,0,5.5]} />
      <TableTennis pos={[-8,0,-7.5]} />
      <Bookshelf pos={[11.4,0,-4]} />
      <Whiteboard pos={[0,3.5,-9.7]} />
      <Plant pos={[-11,0,-9]} />
      <Plant pos={[ 11,0,-9]} />
      <Plant pos={[-11,0, 9]} />
      <Plant pos={[ 11,0, 9]} />
      <CeilingLights />
      <ambientLight intensity={0.35} color="#ffffff" />
      <directionalLight position={[10,15,-5]} intensity={0.6} color="#fff5e6" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      {([[-6,8,-4],[6,8,-4],[-6,8,4],[6,8,4]] as [number,number,number][]).map(([x,y,z],i) => (
        <pointLight key={i} position={[x,y,z]} intensity={0.25} color="#fff5e6" />
      ))}
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true}
        minDistance={8} maxDistance={35} maxPolarAngle={Math.PI/2.2} target={[0,0,0]} />
    </>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Office3D() {
  const [selectedAgent, setSelectedAgent] = useState<number|null>(null);
  const working = agentState.filter(s => s.state === "walking").length;
  const idle    = agentState.filter(s => s.state === "idle" || s.state === "arrived").length;

  return (
    <div style={{ width:"100%",height:"100%",position:"relative" }}
      onClick={() => setSelectedAgent(null)}>
      <HeaderBar working={working} idle={idle} />
      <Canvas shadows camera={{ position:[0,18,14], fov:50 }}
        style={{ width:"100%",height:"100%",paddingTop:56 }}
        onClick={() => setSelectedAgent(null)}>
        <Suspense fallback={null}>
          <Scene selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
        </Suspense>
      </Canvas>
      {selectedAgent !== null && <AgentPopup agentIdx={selectedAgent} onClose={() => setSelectedAgent(null)} />}
      <div style={{
        position:"absolute",bottom:20,left:24,display:"flex",gap:16,
        fontFamily:"system-ui,sans-serif",
      }}>
        {([
          { l:"Walking", c:"#8b5cf6" },
          { l:"At POI",  c:"#f59e0b" },
          { l:"Idle",    c:"#6b7280" },
        ] as {l:string;c:string}[]).map(({l,c}) => (
          <div key={l} style={{ display:"flex",alignItems:"center",gap:6 }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:c }} />
            <span style={{ fontSize:11,color:"#9ca3af" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
