// Shared low-poly prison kit — palette + geometry helpers.
// Usage: import { makeKit } from './prison-kit.js'; const K = makeKit(THREE);
export function makeKit(THREE) {
  const mk = (name, color, o = {}) => new THREE.MeshStandardMaterial({
    name, color, flatShading: true,
    roughness: o.r ?? 0.6, metalness: o.m ?? 0.2,
    ...(o.e ? { emissive: o.e, emissiveIntensity: o.ei ?? 0.7 } : {}),
    ...(o.opacity != null ? { transparent: true, opacity: o.opacity } : {}),
  });
  const M = {
    gold:    mk('gold',    '#d98f2b', { r: 0.5, m: 0.3 }),
    steel:   mk('steel',   '#aeb6bf', { r: 0.45, m: 0.4 }),
    steelD:  mk('steelD',  '#7f8892', { r: 0.5, m: 0.4 }),
    black:   mk('black',   '#26292f', { r: 0.55, m: 0.3 }),
    white:   mk('white',   '#e7ebef', { r: 0.55, m: 0.15 }),
    concrete:mk('concrete','#c3c8ce', { r: 0.85, m: 0.0 }),
    concreteD:mk('concreteD','#9aa0a7',{ r: 0.85, m: 0.0 }),
    wood:    mk('wood',    '#b98a4e', { r: 0.7, m: 0.0 }),
    woodD:   mk('woodD',   '#8f6836', { r: 0.75, m: 0.0 }),
    orange:  mk('orange',  '#f28c3c', { r: 0.5, m: 0.1 }),
    red:     mk('red',     '#d43f3f', { r: 0.5, m: 0.1 }),
    redGlow: mk('redGlow', '#ff4d4d', { r: 0.3, m: 0.0, e: '#ff2a2a', ei: 0.7 }),
    green:   mk('green',   '#3fae5a', { r: 0.5, m: 0.1 }),
    greenGlow:mk('greenGlow','#57e07a',{ r: 0.3, m: 0.0, e: '#39d05f', ei: 0.8 }),
    glass:   mk('glass',   '#bfe0e6', { r: 0.15, m: 0.25, opacity: 0.5 }),
    darkGlass:mk('darkGlass','#2c3138',{ r: 0.2, m: 0.4, opacity: 0.7 }),
    cyan:    mk('cyan',    '#39c6e6', { r: 0.3, m: 0.0, e: '#22b6da', ei: 0.9 }),
    yellow:  mk('yellow',  '#e8c34a', { r: 0.5, m: 0.1 }),
    blue:    mk('blue',    '#5b9bd0', { r: 0.7, m: 0.0 }),
    rubber:  mk('rubber',  '#31363d', { r: 0.7, m: 0.1 }),
  };
  const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w, h, d, mat, name) => mesh(new THREE.BoxGeometry(w, h, d), mat, name);
  const cyl = (rt, rb, h, seg, mat, name) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, name);
  const ico = (r, det, mat, name) => mesh(new THREE.IcosahedronGeometry(r, det), mat, name);
  const sph = (r, mat, name) => mesh(new THREE.SphereGeometry(r, 12, 10), mat, name);
  const torus = (r, t, mat, name) => mesh(new THREE.TorusGeometry(r, t, 10, 24), mat, name);
  return { THREE, M, mk, mesh, box, cyl, ico, sph, torus };
}
