// World convention: +X = east, +Z = north. WMO direction is where wind comes FROM.
// Negative sine/cosine therefore points downwind; scene rotation is only the camera presentation.
export function windVector(degrees = 0, speed = 1) {
  const radians = degrees * Math.PI / 180;
  return { x: -Math.sin(radians) * speed, z: -Math.cos(radians) * speed };
}
