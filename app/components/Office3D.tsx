"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Suspense, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Room ───────────────────────────────────────────────────────────────────
const WALL_HEIGHT = 10;
const ROOM_WIDTH = 24;
const ROOM_DEPTH = 20;

function OfficeRoom() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color="#F5F0E8" />
      </mesh>
      <gridHelper
        args={[Math.max(ROOM_WIDTH, ROOM_DEPTH), 24, "#d4cfc5", "#d4cfc5"]}
        position={[0, 0.01, 0]}
      />
      {/* Back wall */}
      <mesh position={[0, WALL_HEIGHT / 2, -ROOM_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
      {/* Front wall */}
      <mesh position={[0, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
      {/* Right wall */}
      <mesh position={[ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
        <meshStandardMaterial color="#EEEADF" side={2} />
      </mesh>
    </group>
  );
}

// ─── Label billboard ──────────────────────────────────────────────────────────
function Label({ position, children, color = "#ffffff", fontSize = 0.6 }: {
  position: [number, number, number];
  children: React.ReactNode;
  color?: string;
  fontSize?: number;
}) {
  return (
    <Text position={position} fontSize={fontSize} color={color} anchorX="center" anchorY="middle">
      {children}
    </Text>
  );
}

// ─── Agent Desk ──────────────────────────────────────────────────────────────
function AgentDesk({ position, agent }: {
  position: [number, number, number];
  agent: { name: string; emoji: string; color: string; role: string };
}) {
  const screenMat = new THREE.MeshStandardMaterial({ color: agent.color, emissive: new THREE.Color(agent.color), emissiveIntensity: 0.8 });
  const deskMat = new THREE.MeshStandardMaterial({ color: "#3d3d5c" });
  const standMat = new THREE.MeshStandardMaterial({ color: "#2a2a3d" });

  return (
    <group position={position}>
      {/* Desk surface */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.08, 1.2]} />
        <primitive object={deskMat} />
      </mesh>
      {/* Desk legs */}
      {[[-1.1, 0, -0.5], [1.1, 0, -0.5], [-1.1, 0, 0.5], [1.1, 0, 0.5]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, 0.36, z]} castShadow>
          <boxGeometry args={[0.06, 0.72, 0.06]} />
          <primitive object={standMat} />
        </mesh>
      ))}
      {/* Monitor stand */}
      <mesh position={[0, 1.05, -0.1]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
        <primitive object={standMat} />
      </mesh>
      {/* Monitor */}
      <mesh position={[0, 1.3, -0.1]} castShadow>
        <boxGeometry args={[1.0, 0.65, 0.05]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
      {/* Screen glow */}
      <mesh position={[0, 1.3, -0.07]}>
        <planeGeometry args={[0.9, 0.55]} />
        <primitive object={screenMat} />
      </mesh>
      {/* Agent name */}
      <Text position={[0, 1.75, -0.1]} fontSize={0.25} color={agent.color} anchorX="center" anchorY="middle">
        {agent.emoji} {agent.name}
      </Text>
      {/* Role */}
      <Text position={[0, 1.92, -0.1]} fontSize={0.14} color="#9ca3af" anchorX="center" anchorY="middle">
        {agent.role}
      </Text>
    </group>
  );
}

// ─── War Room ────────────────────────────────────────────────────────────────
function WarRoom() {
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#8b5cf6", transparent: true, opacity: 0.15, side: 2,
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Glass walls */}
      {/* Front */}
      <mesh position={[0, 2.2, 3.8]} rotation={[0, 0, 0]}>
        <planeGeometry args={[8, 4.4]} />
        <primitive object={glassMat} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 2.2, -3.8]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[8, 4.4]} />
        <primitive object={glassMat} />
      </mesh>
      {/* Left */}
      <mesh position={[-3.8, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7.6, 4.4]} />
        <primitive object={glassMat} />
      </mesh>
      {/* Right */}
      <mesh position={[3.8, 2.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[7.6, 4.4]} />
        <primitive object={glassMat} />
      </mesh>
      {/* Glass door opening outline */}
      <mesh position={[0, 0.1, 3.81]}>
        <boxGeometry args={[2.5, 3, 0.05]} />
        <meshStandardMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>

      {/* Round table */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.2, 0.1, 32]} />
        <meshStandardMaterial color="#2d2d4a" />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.6, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* 8 chairs around table */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 3.0;
        return (
          <group key={i} position={[Math.sin(angle) * r, 0, Math.cos(angle) * r]} rotation={[0, -angle, 0]}>
            {/* Seat */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.6, 0.08, 0.6]} />
              <meshStandardMaterial color="#3d3d5c" />
            </mesh>
            {/* Back */}
            <mesh position={[0, 0.9, -0.25]} castShadow>
              <boxGeometry args={[0.6, 0.7, 0.08]} />
              <meshStandardMaterial color="#3d3d5c" />
            </mesh>
            {/* Legs */}
            {[[-0.25, 0, -0.25], [0.25, 0, -0.25], [-0.25, 0, 0.25], [0.25, 0, 0.25]].map(([x, y, z], j) => (
              <mesh key={j} position={[x, 0.25, z]} castShadow>
                <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
                <meshStandardMaterial color="#1a1a2e" />
              </mesh>
            ))}
          </group>
        );
      })}

      <Label position={[0, 5.2, 3.85]} color="#8b5cf6" fontSize={0.7}>WAR ROOM</Label>
    </group>
  );
}

// ─── Server Rack ─────────────────────────────────────────────────────────────
function ServerRack({ position }: { position: [number, number, number] }) {
  const ledRefs = useRef<(THREE.Mesh[] | null)[]>([]);

  useFrame(() => {
    ledRefs.current.forEach((row) => {
      if (!row) return;
      row.forEach((led) => {
        if (led && led.material instanceof THREE.MeshStandardMaterial) {
          led.material.emissiveIntensity = Math.random() > 0.7 ? 2 : 0.3;
          led.material.color.set(Math.random() > 0.5 ? "#00ff88" : "#ff8800");
          led.material.emissive.set(Math.random() > 0.5 ? "#00ff88" : "#ff8800");
        }
      });
    });
  });

  const ledColors = ["#00ff88", "#ff8800"];

  return (
    <group position={position}>
      {/* Rack body */}
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 5, 0.8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Server slots */}
      {[-1.5, -0.5, 0.5, 1.5].map((y, rowIdx) => (
        <group key={y}>
          <mesh position={[0, 2.5 + y, 0.41]} castShadow>
            <boxGeometry args={[1.0, 0.7, 0.05]} />
            <meshStandardMaterial color="#111122" />
          </mesh>
          {/* LED lights */}
          {[-0.35, -0.15, 0.05, 0.25, 0.4].map((x, colIdx) => {
            const color = ledColors[(rowIdx + colIdx) % 2];
            return (
              <mesh
                key={colIdx}
                position={[x, 2.5 + y, 0.45]}
                ref={(el: THREE.Mesh | null) => {
                  if (!ledRefs.current[rowIdx]) ledRefs.current[rowIdx] = [];
                  if (el) ledRefs.current[rowIdx]![colIdx] = el;
                }}
              >
                <boxGeometry args={[0.06, 0.06, 0.02]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
              </mesh>
            );
          })}
        </group>
      ))}
      <Label position={[0, 5.5, 0.4]} color="#00ff88" fontSize={0.5}>AI BRAIN</Label>
    </group>
  );
}

// ─── Coffee Station ───────────────────────────────────────────────────────────
function CoffeeStation({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Counter */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.9, 0.8]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>
      {/* Counter top */}
      <mesh position={[0, 1.37, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.06, 0.9]} />
        <meshStandardMaterial color="#5c4433" />
      </mesh>
      {/* Coffee machine */}
      <mesh position={[-0.4, 1.85, 0]} castShadow>
        <boxGeometry args={[0.6, 0.9, 0.6]} />
        <meshStandardMaterial color="#2a2a3d" />
      </mesh>
      <mesh position={[-0.4, 2.35, 0.31]}>
        <boxGeometry args={[0.5, 0.3, 0.02]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
      </mesh>
      {/* Coffee cups */}
      {[0.3, 0.55, 0.8].map((x) => (
        <group key={x} position={[x, 1.44, 0.1]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.06, 0.15, 12]} />
            <meshStandardMaterial color="#e8d5c4" />
          </mesh>
        </group>
      ))}
      <Label position={[0, 2.9, 0.4]} color="#c4813a" fontSize={0.45}>FUEL STATION ☕</Label>
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
      {/* TV mount on wall */}
      <mesh position={[0, 3.5, -0.05]} ref={tvRef}>
        <boxGeometry args={[3.5, 2.0, 0.06]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.4} />
      </mesh>
      {/* Sofa 1 (blue) */}
      <mesh position={[-1.2, 0.45, 1.5]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.5, 0.8]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
      <mesh position={[-1.2, 0.85, 1.1]} castShadow>
        <boxGeometry args={[2.0, 0.7, 0.15]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>
      {/* Sofa 2 (purple) */}
      <mesh position={[1.2, 0.45, 1.5]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.5, 0.8]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      <mesh position={[1.2, 0.85, 1.1]} castShadow>
        <boxGeometry args={[2.0, 0.7, 0.15]} />
        <meshStandardMaterial color="#3b0764" />
      </mesh>
      {/* Coffee table */}
      <mesh position={[0, 0.35, 2.5]} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.08, 24]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0, 0.15, 2.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
      <Label position={[0, 5.0, -0.1]} color="#3b82f6" fontSize={0.6}>CHILL ZONE</Label>
    </group>
  );
}

// ─── Table Tennis ────────────────────────────────────────────────────────────
function TableTennis({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table */}
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.0, 0.1, 2.0]} />
        <meshStandardMaterial color="#166534" />
      </mesh>
      {/* White lines */}
      <mesh position={[0, 0.82, 0]}>
        <planeGeometry args={[0.05, 1.8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[3.8, 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Net */}
      <mesh position={[0, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.8, 0.4]} />
        <meshStandardMaterial color="#e5e7eb" transparent opacity={0.7} />
      </mesh>
      {/* Net posts */}
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      ))}
      {/* Balls */}
      {[[1.5, 0.85, 0.6], [1.7, 0.85, -0.5], [1.6, 0.85, 0.2]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
      ))}
      <Label position={[0, 1.7, 0]} color="#166534" fontSize={0.45}>GAME ZONE 🏓</Label>
    </group>
  );
}

// ─── Bookshelf ────────────────────────────────────────────────────────────────
const BOOK_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function Bookshelf({ position }: { position: [number, number, number] }) {
  const shelfMat = new THREE.MeshStandardMaterial({ color: "#5c3d2e" });
  const books: { x: number; y: number; z: number; h: number; w: number; color: string }[] = [];
  let bx = -0.9;
  let by = 0;
  let row = 0;
  while (row < 4) {
    const h = 0.5 + Math.random() * 0.3;
    const w = 0.08 + Math.random() * 0.06;
    books.push({ x: bx, y: by + h / 2, z: 0, h, w, color: BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)] });
    bx += w + 0.02;
    if (bx > 0.9) {
      bx = -0.9;
      by += 0.7;
      row++;
    }
  }

  return (
    <group position={position}>
      {/* Shelf frame */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 3.0, 0.4]} />
        <primitive object={shelfMat} />
      </mesh>
      {/* Shelves (planks) */}
      {[0, 0.7, 1.4, 2.1].map((y) => (
        <mesh key={y} position={[0, y, 0.05]} receiveShadow>
          <boxGeometry args={[2.1, 0.05, 0.35]} />
          <meshStandardMaterial color="#7a5240" />
        </mesh>
      ))}
      {/* Books */}
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} castShadow>
          <boxGeometry args={[b.w, b.h, 0.25]} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Whiteboard ──────────────────────────────────────────────────────────────
function Whiteboard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[4.5, 3.0, 0.06]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 0, -0.04]} castShadow>
        <boxGeometry args={[4.7, 3.2, 0.04]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* Scribble lines (tasks) */}
      {[-0.6, -0.2, 0.2, 0.6].map((y, i) => (
        <mesh key={i} position={[0, y, 0.04]}>
          <planeGeometry args={[3.5 + Math.random() * 0.5, 0.03]} />
          <meshStandardMaterial color="#8b5cf6" />
        </mesh>
      ))}
      <Label position={[0, 1.8, 0.1]} color="#8b5cf6" fontSize={0.4}>TASKS</Label>
    </group>
  );
}

// ─── Plant ───────────────────────────────────────────────────────────────────
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.5, 12]} />
        <meshStandardMaterial color="#7c3aed" />
      </mesh>
      {/* Leaves (sphere) */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
    </group>
  );
}

// ─── Minecraft Agent ───────────────────────────────────────────────────────────
const SKIN_COLOR = "#D4956A";
const HAIR_COLORS: Record<string, string> = {
  Ethan: "#4a1a7a", Lucas: "#1a3a7a", Sophia: "#0a5a3a",
  Noah: "#7a5a10", Michael: "#7a1a1a", Olivia: "#7a4a10", William: "#3a3a7a",
};

function MinecraftAgent({ agent }: { agent: { name: string; emoji: string; color: string; role: string; pos: [number, number, number] } }) {
  const groupRef = useRef<THREE.Group>(null);
  const [isMoving, setIsMoving] = useState(false);
  const timeOffset = AGENTS.findIndex(a => a.name === agent.name) * 1.4;

  // Walk to desk and back — simple patrol loop
  const deskPos = new THREE.Vector3(...agent.pos);
  const wanderPos = new THREE.Vector3(
    agent.pos[0] + (Math.random() - 0.5) * 3,
    agent.pos[1],
    agent.pos[2] + (Math.random() - 0.5) * 3
  );
  const targetRef = useRef(deskPos.clone());
  const velRef = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime + timeOffset;
    const cycle = Math.sin(t * 0.3) > 0;
    const target = cycle ? deskPos : wanderPos;
    targetRef.current.lerp(target, 0.008);
    const dist = groupRef.current.position.distanceTo(targetRef.current);
    const moving = dist > 0.15;
    setIsMoving(moving);

    if (moving) {
      const dir = targetRef.current.clone().sub(groupRef.current.position).normalize();
      groupRef.current.position.addScaledVector(dir, 0.025);
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // Limb swing — only animate when moving
    const swing = isMoving ? Math.sin(t * 6) * 0.4 : 0;
    const legSwing = isMoving ? -Math.sin(t * 6) * 0.35 : 0;

    // Update limb rotations via refs would need more complexity; using group children approach
    // Instead, apply swing to the group children — handled via mesh refs
    const children = groupRef.current.children;
    // Arms and legs are at specific indices in the group
    if (children[2]) children[2].rotation.x = swing;      // left arm
    if (children[3]) children[3].rotation.x = -swing;     // right arm
    if (children[4]) children[4].rotation.x = legSwing;   // left leg
    if (children[5]) children[5].rotation.x = -legSwing;  // right leg
  });

  const hairColor = HAIR_COLORS[agent.name] ?? "#333333";

  return (
    <group ref={groupRef} position={agent.pos}>
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
      {/* Body (torso) */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.6, 0.7, 0.3]} />
        <meshStandardMaterial color={agent.color} />
      </mesh>
      {/* Left Arm */}
      <mesh position={[-0.45, 1.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.65, 0.2]} />
        <meshStandardMaterial color={agent.color} />
      </mesh>
      {/* Right Arm */}
      <mesh position={[0.45, 1.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.65, 0.2]} />
        <meshStandardMaterial color={agent.color} />
      </mesh>
      {/* Left Leg */}
      <mesh position={[-0.15, 0.65, 0]} castShadow>
        <boxGeometry args={[0.25, 0.55, 0.25]} />
        <meshStandardMaterial color={agent.color} />
      </mesh>
      {/* Right Leg */}
      <mesh position={[0.15, 0.65, 0]} castShadow>
        <boxGeometry args={[0.25, 0.55, 0.25]} />
        <meshStandardMaterial color={agent.color} />
      </mesh>
      {/* Name tag */}
      <Text position={[0, 2.55, 0]} fontSize={0.22} color={agent.color} anchorX="center" anchorY="middle">
        {agent.emoji} {agent.name}
      </Text>
      <Text position={[0, 2.32, 0]} fontSize={0.13} color="#9ca3af" anchorX="center" anchorY="middle">
        {agent.role}
      </Text>
    </group>
  );
}

// ─── Ceiling Lights ───────────────────────────────────────────────────────────
function CeilingLights() {
  const positions: [number, number, number][] = [
    [-6, 9.4, -4], [0, 9.4, -4], [6, 9.4, -4],
    [-6, 9.4, 4], [0, 9.4, 4], [6, 9.4, 4],
  ];
  return (
    <>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <boxGeometry args={[1.2, 0.12, 0.5]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
          <pointLight position={[0, -0.3, 0]} intensity={0.5} color="#fffbe6" distance={6} />
        </group>
      ))}
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
const AGENTS = [
  { name: "Ethan", emoji: "👑", color: "#8b5cf6", role: "Team Lead", pos: [0, 0, -8] as [number,number,number] },
  { name: "Lucas", emoji: "🔨", color: "#3b82f6", role: "Builder", pos: [-9, 0, -6] as [number,number,number] },
  { name: "Sophia", emoji: "✍️", color: "#10b981", role: "Content", pos: [-9, 0, 4] as [number,number,number] },
  { name: "Noah", emoji: "🔭", color: "#f59e0b", role: "Research", pos: [9, 0, -6] as [number,number,number] },
  { name: "Michael", emoji: "🧪", color: "#ef4444", role: "QA", pos: [9, 0, 4] as [number,number,number] },
  { name: "Olivia", emoji: "💼", color: "#f97316", role: "Brand", pos: [-4, 0, 8.5] as [number,number,number] },
  { name: "William", emoji: "⚙️", color: "#6366f1", role: "Ops", pos: [4, 0, 8.5] as [number,number,number] },
];

function Scene() {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 30, 60]} />
      <OfficeRoom />

      {/* Agent Desks */}
      {AGENTS.map((a) => (
        <AgentDesk key={a.name} agent={a} position={a.pos} />
      ))}

      {/* Minecraft Agents — standing near their desks */}
      {AGENTS.map((a) => (
        <MinecraftAgent key={a.name} agent={a} />
      ))}

      {/* War Room */}
      <WarRoom />

      {/* Server Rack — left wall */}
      <ServerRack position={[-10.9, 0, -6]} />

      {/* Coffee Station — back right */}
      <CoffeeStation position={[9, 0, -8.6]} />

      {/* TV Lounge — front right */}
      <TVLounge position={[9.5, 0, 5.5]} />

      {/* Table Tennis — back left */}
      <TableTennis position={[-8, 0, -7.5]} />

      {/* Bookshelf — right wall */}
      <Bookshelf position={[11.4, 0, -4]} />

      {/* Whiteboard — back wall */}
      <Whiteboard position={[0, 3.5, -9.7]} />

      {/* Plants in corners */}
      <Plant position={[-11, 0, -9]} />
      <Plant position={[11, 0, -9]} />
      <Plant position={[-11, 0, 9]} />
      <Plant position={[11, 0, 9]} />

      {/* Ceiling Lights */}
      <CeilingLights />

      {/* Main Lighting */}
      <ambientLight intensity={0.35} color="#ffffff" />
      <directionalLight position={[10, 15, -5]} intensity={0.6} color="#fff5e6" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-6, 8, -4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[6, 8, -4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[-6, 8, 4]} intensity={0.25} color="#fff5e6" />
      <pointLight position={[6, 8, 4]} intensity={0.25} color="#fff5e6" />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={15}
        maxDistance={55}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 3, 0]}
      />
    </>
  );
}

export default function Office3D() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute", top: 20, left: 24, zIndex: 10, color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontSize: "24px", fontWeight: 700 }}>🏢 Virtual Office</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          Drag to orbit • Scroll to zoom • Ethan&apos;s team HQ
        </div>
      </div>
      <Canvas shadows camera={{ position: [0, 18, 28], fov: 50 }} style={{ width: "100%", height: "100%" }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
