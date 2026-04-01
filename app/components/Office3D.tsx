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
type AgentGlobalState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  state: "idle" | "walking" | "arrived";
  idleUntil: number; // Unix time (seconds) when idle ends. -1 = first-time not started yet
  timer: number;      // seconds until first move
};

// ─── Constants ────────────────────────────────────────────────────────────────
const MOVE_SPEED  = 1.5;
const ARRIVE_THRESHOLD = 0.3;
const REPULSION_RADIUS = 1.5;
const REPULSION_FORCE  = 0.06;

// Inner boundary (inside walls)
const BX_MIN = -11.0, BX_MAX = 11.0;
const BZ_MIN = -9.0,  BZ_MAX = 9.0;

const POIS: [number, number, number][] = [
  [-10.9, 0, -6],   // Server rack
  [9, 1.37, -8.6],  // Coffee counter top
  [9.5, 0.75, 6.3], // TV lounge sofa
  [-8, 0.76, -7.5], // Ping pong
  [0, 0.8, 0],      // War room table
  [0, 3.5, -8.5],   // Whiteboard
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

// Shared module-level state — one entry per agent
const globalPositions: THREE.Vector3[] = AGENTS_META.map(a => new THREE.Vector3(...a.pos));

const agentStates: AgentGlobalState[] = AGENTS_META.map((a) => ({
  position: new THREE.Vector3(...a.pos),
  target:   new THREE.Vector3(...a.pos),
  state:    "idle" as const,
  idleUntil: -1,              // -1 = not started, set on first frame
  timer:    4 + Math.random() * 5, // 4-9 sec
}));

// ─── Furniture collision boxes ─────────────────────────────────────────────────
const FURNITURE_BOXES = [
  { min: new THREE.Vector3(-3.8, 0, -3.8), max: new THREE.Vector3(3.8, 4.4, 3.8) },  // War room
  { min: new THREE.Vector3(-11.5, 0, -9),  max: new THREE.Vector3(-10.3, 5, -5.2) }, // Server rack
  { min: new THREE.Vector3(8, 0, -9.2),    max: new THREE.Vector3(10, 3, -8)     },  // Coffee counter
  { min: new THREE.Vector3(8, 0, 5),       max: new THREE.Vector3(11, 4.5, 7)    },  // TV lounge
  { min: new THREE.Vector3(-10, 0, -9.5),  max: new THREE.Vector3(-6, 3, -5.5)  },  // Ping pong
];

function isInsideFurniture(p: THREE.Vector3): boolean {
  for (const box of FURNITURE_BOXES) {
    if (p.x > box.min.x && p.x < box.max.x && p.z > box.min.z && p.z < box.max.z) return true;
  }
  return false;
}

function pickValidDest(agentIdx: number): THREE.Vector3 {
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = Math.random();
    let dest: THREE.Vector3;

    if (r < 0.4) {
      dest = new THREE.Vector3(
        BX_MIN + 1 + Math.random() * (BX_MAX - BX_MIN - 2),
        0,
        BZ_MIN + 1 + Math.random() * (BZ_MAX - BZ_MIN - 2)
      );
    } else if (r < 0.8) {
      const poi = POIS[Math.floor(Math.random() * POIS.length)];
      dest = new THREE.Vector3(poi[0], 0, poi[2]);
    } else {
      const dp = AGENTS_META[agentIdx].pos;
      dest = new THREE.Vector3(
        dp[0] + (Math.random() - 0.5) * 2,
        0,
        dp[2] + (Math.random() - 0.5) * 2
      );
    }

    if (
      !isInsideFurniture(dest) &&
      dest.x > BX_MIN && dest.x < BX_MAX &&
      dest.z > BZ_MIN && dest.z < BZ_MAX
    ) {
      return dest;
    }
  }
  // Fallback: walk to a spot near desk
  const dp = AGENTS_META[agentIdx].pos;
  return new THREE.Vector3(dp[0] + 2, 0, dp[2]);
}

const HAIR_COLORS: Record<string, string> = {
  Ethan: "#4a1a7a", Lucas: "#1a3a7a", Sophia: "#0a5a3a",
  Noah: "#7a5a10", Michael: "#7a1a1a", Olivia: "#7a4a10", William: "#3a3a7a",
};
const SKIN_COLOR = "#D4956A";

// ─── Agent desk ──────────────────────────────────────────────────────────────
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

// ─── Minecraft Agent ─────────────────────────────────────────────────────────
function MinecraftAgent({
  agentIdx, agentData, onSelect, isSelected
}: {
  agentIdx: number; agentData: AgentData;
  onSelect: (idx: number) => void; isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const armLRef  = useRef<THREE.Mesh>(null);
  const armRRef  = useRef<THREE.Mesh>(null);
  const legLRef  = useRef<THREE.Mesh>(null);
  const legRRef  = useRef<THREE.Mesh>(null);

  const state = agentStates[agentIdx];
  const hairColor = HAIR_COLORS[agentData.name] ?? "#333333";

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const now = clock.elapsedTime;
    const pos = globalPositions[agentIdx];

    // ── First-frame initialization ──────────────────────────────────────────
    if (state.idleUntil < 0) {
      state.idleUntil = now + state.timer; // start first idle countdown
    }

    // ── IDLE state ──────────────────────────────────────────────────────────
    if (state.state === "idle") {
      if (now >= state.idleUntil) {
        state.target.copy(pickValidDest(agentIdx));
        state.state = "walking";
      }
    }
    // ── ARRIVED state ──────────────────────────────────────────────────────
    else if (state.state === "arrived") {
      if (now >= state.idleUntil) {
        state.target.copy(pickValidDest(agentIdx));
        state.state = "walking";
      }
    }
    // ── WALKING state ──────────────────────────────────────────────────────
    else if (state.state === "walking") {
      const dir  = state.target.clone().sub(pos);
      const dist = dir.length();

      // Agent-agent repulsion
      const repulsion = new THREE.Vector3();
      for (let j = 0; j < globalPositions.length; j++) {
        if (j === agentIdx) continue;
        const diff = pos.clone().sub(globalPositions[j]);
        const d = diff.length();
        if (d < REPULSION_RADIUS && d > 0.01) {
          repulsion.addScaledVector(diff.normalize(), (REPULSION_RADIUS - d) * REPULSION_FORCE * 3);
        }
      }

      if (dist < ARRIVE_THRESHOLD) {
        // Arrived — switch to idle
        state.state     = "arrived";
        state.idleUntil = now + 2 + Math.random() * 2; // idle 2-4 seconds
        state.timer     = 4 + Math.random() * 6;         // next move in 4-10 seconds
        state.position.copy(state.target);
      } else {
        const step = MOVE_SPEED * delta;
        const move = dir.clone().normalize().multiplyScalar(Math.min(step, dist)).add(repulsion);
        const next = pos.clone().add(move);
        next.x = Math.max(BX_MIN, Math.min(BX_MAX, next.x));
        next.z = Math.max(BZ_MIN, Math.min(BZ_MAX, next.z));
        state.position.copy(next);
      }
    }

    // ── Apply position ──────────────────────────────────────────────────────
    groupRef.current.position.copy(state.position);

    // ── Face direction ──────────────────────────────────────────────────────
    const tDir = state.target.clone().sub(pos);
    if (tDir.length() > 0.1) {
      groupRef.current.rotation.y = Math.atan2(tDir.x, tDir.z);
    }

    // ── Limb animation ──────────────────────────────────────────────────────
    const walking = state.state === "walking";
    const swing   = walking ? Math.sin(now * 6) * 0.4 : 0;
    const lSwing  = walking ? -Math.sin(now * 6) * 0.35 : 0;

    if (armLRef.current) armLRef.current.rotation.x = swing;
    if (armRRef.current) armRRef.current.rotation.x = -swing;
    if (legLRef.current) legLRef.current.rotation.x = lSwing;
    if (legRRef.current) legRRef.current.rotation.x = -lSwing;

    // Idle bob
    groupRef.current.position.y = state.position.y + (walking ? 0 : Math.sin(now * 1.2) * 0.02);
  });

  return (
    <group
      ref={groupRef}
      position={agentData.pos}
      onClick={(e) => { e.stopPropagation(); onSelect(agentIdx); }}
    >
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.7, 32]} />
          <meshStandardMaterial color={agentData.color} emissive={new THREE.Color(agentData.color)} emissiveIntensity={1} />
        </mesh>
      )}
      <mesh position={[0,1.8,0]} castShadow><boxGeometry args={[0.5,0.5,0.5]} /><meshStandardMaterial color={SKIN_COLOR} /></mesh>
      <mesh position={[0,2.1,0]} castShadow><boxGeometry args={[0.52,0.15,0.52]} /><meshStandardMaterial color={hairColor} /></mesh>
      <mesh position={[-0.1,1.85,0.26]}><boxGeometry args={[0.08,0.08,0.02]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0.1,1.85,0.26]}><boxGeometry args={[0.08,0.08,0.02]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0,1.15,0]} castShadow><boxGeometry args={[0.6,0.7,0.3]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <mesh ref={armLRef} position={[-0.45,1.2,0]} castShadow><boxGeometry args={[0.2,0.65,0.2]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <mesh ref={armRRef} position={[0.45,1.2,0]} castShadow><boxGeometry args={[0.2,0.65,0.2]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <mesh ref={legLRef} position={[-0.15,0.65,0]} castShadow><boxGeometry args={[0.25,0.55,0.25]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <mesh ref={legRRef} position={[0.15,0.65,0]} castShadow><boxGeometry args={[0.25,0.55,0.25]} /><meshStandardMaterial color={agentData.color} /></mesh>
      <Text position={[0,2.6,0]} fontSize={0.2} color={agentData.color} anchorX="center" anchorY="middle">
        {agentData.emoji} {agentData.name}
      </Text>
      <Text position={[0,2.38,0]} fontSize={0.12} color="#9ca3af" anchorX="center" anchorY="middle">
        {agentData.role}
      </Text>
    </group>
  );
}

// ─── Popup ────────────────────────────────────────────────────────────────────
function AgentPopup({ agentIdx, onClose }: { agentIdx: number; onClose: () => void }) {
  const agent = AGENTS_META[agentIdx];
  const state = agentStates[agentIdx];
  const status = state.state === "walking" ? "working" : "idle";
  const [taskInfo, setTaskInfo] = useState({ current: "Loading...", completed: 0 });

  useEffect(() => {
    fetch("/api/tasks")
      .then(r => r.json())
      .then((tasks: { agent: string; status: string; title: string }[]) => {
        const at = tasks.filter(t => t.agent === agent.name);
        const ip = at.find(t => t.status === "in-progress");
        setTaskInfo({ current: ip?.title ?? "No active task", completed: at.filter(t => t.status === "completed").length });
      })
      .catch(() => setTaskInfo({ current: "No active task", completed: 0 }));
  }, [agent.name]);

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
          width:48,height:48,borderRadius:12,
          background:`${agent.color}20`,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:24,border:`1px solid ${agent.color}40`,
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
          background: status==="working"?"#10b98120":"#f59e0b20",
          color: status==="working"?"#10b981":"#f59e0b",
        }}>
          {status === "working" ? "🟢 Working" : "🟡 Idle"}
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
      background:"rgba(10,10,20,0.85)",backdropFilter:"blur(12px)",
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
      <div style={{
        background:"#8b5cf6",borderRadius:20,
        padding:"2px 10px",fontSize:12,fontWeight:600,color:"#fff",
      }}>
        {working+idle} agents
      </div>
    </div>
  );
}

// ─── Office Room ─────────────────────────────────────────────────────────────
function OfficeRoom() {
  const wallMat = { color:"#EEEADF", transparent:true, opacity:0.35, side:2 } as const;
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[24, 20]} />
        <meshStandardMaterial color="#F5F0E8" />
      </mesh>
      <gridHelper args={[24, 24, "#d4cfc5", "#d4cfc5"]} position={[0,0.01,0]} />
      <mesh position={[0,5,-10]}><planeGeometry args={[24,10]} /><meshStandardMaterial {...wallMat} /></mesh>
      <mesh position={[0,5, 10]} rotation={[0,Math.PI,0]}><planeGeometry args={[24,10]} /><meshStandardMaterial {...wallMat} /></mesh>
      <mesh position={[-12,5,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[20,10]} /><meshStandardMaterial {...wallMat} /></mesh>
      <mesh position={[ 12,5,0]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[20,10]} /><meshStandardMaterial {...wallMat} /></mesh>
    </group>
  );
}

// ─── Label ───────────────────────────────────────────────────────────────────
function Label3D({ position, children, color="#ffffff", fontSize=0.6 }: {
  position:[number,number,number]; children:React.ReactNode; color?:string; fontSize?:number;
}) {
  return <Text position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle">{children}</Text>;
}

// ─── War Room ────────────────────────────────────────────────────────────────
function WarRoom() {
  const glassMat = { color:"#8b5cf6", transparent:true, opacity:0.12, side:2 } as const;
  return (
    <group position={[0,0,0]}>
      <mesh position={[0,2.2,3.8]}><planeGeometry args={[8,4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[0,2.2,-3.8]} rotation={[0,Math.PI,0]}><planeGeometry args={[8,4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[-3.8,2.2,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[7.6,4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
      <mesh position={[3.8,2.2,0]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[7.6,4.4]} /><meshStandardMaterial {...glassMat} /></mesh>
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
      <Label3D position={[0,5.2,3.85]} color="#8b5cf6" fontSize={0.7}>WAR ROOM</Label3D>
    </group>
  );
}

// ─── Server Rack ─────────────────────────────────────────────────────────────
function ServerRack({ position }: { position:[number,number,number] }) {
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    ledRefs.current.forEach(led => {
      if (!led || !(led.material instanceof THREE.MeshStandardMaterial)) return;
      if (Math.random() > 0.85) {
        led.material.emissiveIntensity = 2;
        const c = Math.random() > 0.5 ? "#00ff88" : "#ff8800";
        led.material.color.set(c); led.material.emissive.set(c);
      } else { led.material.emissiveIntensity = 0.2; }
    });
  });
  return (
    <group position={position}>
      <mesh position={[0,2.5,0]} castShadow receiveShadow><boxGeometry args={[1.2,5,0.8]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      {[-1.5,-0.5,0.5,1.5].map((y,ri) =>
        [-0.35,-0.15,0.05,0.25,0.4].map((x,ci) => {
          const col = (ri+ci)%2===0 ? "#00ff88" : "#ff8800";
          return (
            <mesh key={`${ri}-${ci}`} position={[x,2.5+y,0.45]}
              ref={el => { ledRefs.current[ri*5+ci] = el; }}>
              <boxGeometry args={[0.06,0.06,0.02]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} />
            </mesh>
          );
        })
      )}
      <Label3D position={[0,5.5,0.4]} color="#00ff88" fontSize={0.5}>AI BRAIN</Label3D>
    </group>
  );
}

// ─── Coffee Station ─────────────────────────────────────────────────────────
function CoffeeStation({ position }: { position:[number,number,number] }) {
  return (
    <group position={position}>
      <mesh position={[0,0.9,0]} castShadow receiveShadow><boxGeometry args={[2.0,0.9,0.8]} /><meshStandardMaterial color="#4a3728" /></mesh>
      <mesh position={[0,1.37,0]} castShadow receiveShadow><boxGeometry args={[2.1,0.06,0.9]} /><meshStandardMaterial color="#5c4433" /></mesh>
      <mesh position={[-0.4,1.85,0]} castShadow><boxGeometry args={[0.6,0.9,0.6]} /><meshStandardMaterial color="#2a2a3d" /></mesh>
      <mesh position={[-0.4,2.35,0.31]}><boxGeometry args={[0.5,0.3,0.02]} /><meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} /></mesh>
      {[0.3,0.55,0.8].map((x,i) => (
        <mesh key={i} position={[x,1.44,0.1]} castShadow><cylinderGeometry args={[0.08,0.06,0.15,12]} /><meshStandardMaterial color="#e8d5c4" /></mesh>
      ))}
      <Label3D position={[0,2.9,0.4]} color="#c4813a" fontSize={0.45}>FUEL STATION ☕</Label3D>
    </group>
  );
}

// ─── TV Lounge ───────────────────────────────────────────────────────────────
function TVLounge({ position }: { position:[number,number,number] }) {
  const tvRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (tvRef.current && tvRef.current.material instanceof THREE.MeshStandardMaterial)
      tvRef.current.material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime*1.5)*0.15;
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
      <Label3D position={[0,5.0,-0.1]} color="#3b82f6" fontSize={0.6}>CHILL ZONE</Label3D>
    </group>
  );
}

// ─── Table Tennis ─────────────────────────────────────────────────────────────
function TableTennis({ position }: { position:[number,number,number] }) {
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
      <Label3D position={[0,1.7,0]} color="#166534" fontSize={0.45}>GAME ZONE 🏓</Label3D>
    </group>
  );
}

// ─── Bookshelf ────────────────────────────────────────────────────────────────
const BOOK_COLORS = ["#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];
function Bookshelf({ position }: { position:[number,number,number] }) {
  const books: {x:number;y:number;col:string;h:number}[] = [];
  let bx=-0.9, by=0, row=0;
  while (row < 4) {
    const h=0.5+Math.random()*0.3, w=0.08+Math.random()*0.06;
    books.push({x:bx+w/2, y:by+h/2, col:BOOK_COLORS[Math.floor(Math.random()*BOOK_COLORS.length)], h});
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
        <mesh key={i} position={[b.x,b.y,0]} castShadow><boxGeometry args={[0.13,b.h,0.25]} /><meshStandardMaterial color={b.col} /></mesh>
      ))}
    </group>
  );
}

// ─── Whiteboard ───────────────────────────────────────────────────────────────
function Whiteboard({ position }: { position:[number,number,number] }) {
  return (
    <group position={position}>
      <mesh castShadow><boxGeometry args={[4.5,3.0,0.06]} /><meshStandardMaterial color="#f0f0f0" /></mesh>
      <mesh position={[0,0,-0.04]} castShadow><boxGeometry args={[4.7,3.2,0.04]} /><meshStandardMaterial color="#374151" /></mesh>
      {[-0.6,-0.2,0.2,0.6].map((y,i) => (
        <mesh key={i} position={[0,y,0.04]}><planeGeometry args={[3.5+i*0.1,0.03]} /><meshStandardMaterial color="#8b5cf6" /></mesh>
      ))}
      <Label3D position={[0,1.8,0.1]} color="#8b5cf6" fontSize={0.4}>TASKS</Label3D>
    </group>
  );
}

// ─── Plant ───────────────────────────────────────────────────────────────────
function Plant({ position }: { position:[number,number,number] }) {
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
  const pos: [number,number,number][] = [[-6,9.4,-4],[0,9.4,-4],[6,9.4,-4],[-6,9.4,4],[0,9.4,4],[6,9.4,4]];
  return (
    <>
      {pos.map((p,i) => (
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
        <MinecraftAgent key={a.name} agentIdx={i} agentData={a}
          onSelect={onSelectAgent} isSelected={selectedAgent===i} />
      ))}
      <WarRoom />
      <ServerRack position={[-10.9,0,-6]} />
      <CoffeeStation position={[9,0,-8.6]} />
      <TVLounge position={[9.5,0,5.5]} />
      <TableTennis position={[-8,0,-7.5]} />
      <Bookshelf position={[11.4,0,-4]} />
      <Whiteboard position={[0,3.5,-9.7]} />
      <Plant position={[-11,0,-9]} />
      <Plant position={[11,0,-9]} />
      <Plant position={[-11,0,9]} />
      <Plant position={[11,0,9]} />
      <CeilingLights />
      <ambientLight intensity={0.35} color="#ffffff" />
      <directionalLight position={[10,15,-5]} intensity={0.6} color="#fff5e6" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-6,8,-4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[6,8,-4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[-6,8,4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[6,8,4]} intensity={0.25} color="#fff5e6" />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true}
        minDistance={8} maxDistance={35} maxPolarAngle={Math.PI/2.2} target={[0,0,0]} />
    </>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Office3D() {
  const [selectedAgent, setSelectedAgent] = useState<number|null>(null);
  const walking = agentStates.filter(s => s.state === "walking").length;
  const idle    = agentStates.filter(s => s.state === "idle" || s.state === "arrived").length;

  return (
    <div style={{ width:"100%",height:"100%",position:"relative" }}
      onClick={() => setSelectedAgent(null)}>
      <HeaderBar working={walking} idle={idle} />
      <Canvas shadows camera={{ position:[0,18,14], fov:50 }}
        style={{ width:"100%",height:"100%",paddingTop:56 }}
        onClick={() => setSelectedAgent(null)}>
        <Suspense fallback={null}>
          <Scene selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
        </Suspense>
      </Canvas>
      {selectedAgent !== null && <AgentPopup agentIdx={selectedAgent} onClose={() => setSelectedAgent(null)} />}
      <div style={{ position:"absolute",bottom:20,left:24,display:"flex",gap:16,fontFamily:"system-ui,sans-serif" }}>
        {[{l:"Walking",c:"#8b5cf6"},{l:"At POI",c:"#f59e0b"},{l:"Idle",c:"#6b7280"}].map(({l,c}) => (
          <div key={l} style={{ display:"flex",alignItems:"center",gap:6 }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:c }} />
            <span style={{ fontSize:11,color:"#9ca3af" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
