import React, { useRef } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useTimeline } from "../../kit/stage";
import { ease, progress, noise1D } from "../../kit/motion";

/** M0 test subject: a rounded cube that whips through 2.5 turns mid-shot. */
export const CubeScene: React.FC = () => {
  const cube = useRef<THREE.Mesh>(null!);
  const camera = useThree((s) => s.camera);
  useTimeline((t) => {
    const k = progress(t, 10, 80, ease.inOut);
    cube.current.rotation.set(0.35, k * Math.PI * 5 + 0.6, 0);
    cube.current.position.y = 0.75 + Math.sin(k * Math.PI) * 0.35;
    // slow push + subtle handheld drift
    const push = progress(t, 0, 90, ease.cine);
    camera.position.set(
      0 + noise1D(t / 30, 1) * 0.02,
      1.4 + noise1D(t / 30, 2) * 0.015,
      5.2 - push * 0.9,
    );
    camera.lookAt(0, 0.75, 0);
  });
  return (
    <>
      <hemisphereLight args={["#9fb8ff", "#2a1a10", 0.35]} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={3.2}
        color="#ffd2a1"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <RoundedBox ref={cube} args={[1, 1, 1]} radius={0.08} smoothness={6} castShadow receiveShadow>
        <meshStandardMaterial color="#e2602f" roughness={0.38} metalness={0.05} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#3a3d44" roughness={0.9} />
      </mesh>
      {/* a hot rim for bloom testing */}
      <mesh position={[-1.8, 1.6, -2.5]}>
        <sphereGeometry args={[0.12, 32, 16]} />
        <meshBasicMaterial color={[6, 4.2, 2.5]} toneMapped={false} />
      </mesh>
    </>
  );
};
