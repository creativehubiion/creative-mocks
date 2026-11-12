// Stylised glass: a cheap, smooth analytic sky reflection patched into a MeshStandard/Lambert material.
// No cubemap, no render target: the fragment shader reflects the view vector about the (smooth, interpolated) normal
// and colours it from a continuous sky gradient (ground tint below the horizon, horizon, zenith above), a soft sun glow,
// a very soft broad sheen and a soft fresnel lift. Three's dithering is switched on to hide banding at dusk.
// Usage: import { patchGlass } from './glass.js';
//   patchGlass(mesh.material, () => ({ zenith, horizon, ground, sunDir, sunColor }), { mix: 0.7 });
// getSky is optional and read every frame; colours may be THREE.Color or hex/CSS strings, sunDir a THREE.Vector3
// pointing from the scene toward the sun. Without it the defaults below give a clear midday sky.
import { Color, Vector3 } from 'three';

export const GLASS_DEFAULT_SKY = {
  zenith: '#5d8fd0',
  horizon: '#d9e6ef',
  ground: '#5a4a3c',
  sunDir: new Vector3(0.45, 0.75, 0.48).normalize(),
  sunColor: '#fff1d6',
};

function setColor(target, v) {
  if (v === undefined || v === null) return;
  if (v.isColor) target.copy(v); else target.set(v);
}

export function patchGlass(material, getSky, opts = {}) {
  const u = {
    uGlassZenith: { value: new Color(GLASS_DEFAULT_SKY.zenith) },
    uGlassHorizon: { value: new Color(GLASS_DEFAULT_SKY.horizon) },
    uGlassGround: { value: new Color(GLASS_DEFAULT_SKY.ground) },
    uGlassSunDir: { value: GLASS_DEFAULT_SKY.sunDir.clone() },
    uGlassSunColor: { value: new Color(GLASS_DEFAULT_SKY.sunColor) },
    uGlassMix: { value: opts.mix !== undefined ? opts.mix : 0.45 },
  };
  const update = () => {
    if (!getSky) return;
    const s = getSky();
    if (!s) return;
    setColor(u.uGlassZenith.value, s.zenith);
    setColor(u.uGlassHorizon.value, s.horizon);
    setColor(u.uGlassGround.value, s.ground);
    setColor(u.uGlassSunColor.value, s.sunColor);
    if (s.sunDir) u.uGlassSunDir.value.copy(s.sunDir).normalize();
  };
  update();
  material.userData.glassUniforms = u;
  material.userData.updateGlass = update;
  material.dithering = true;
  const prevBefore = material.onBeforeRender;
  material.onBeforeRender = function (...args) {
    update();
    if (prevBefore) prevBefore.apply(this, args);
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform highp vec3 uGlassZenith;
uniform highp vec3 uGlassHorizon;
uniform highp vec3 uGlassGround;
uniform highp vec3 uGlassSunDir;
uniform highp vec3 uGlassSunColor;
uniform highp float uGlassMix;`)
      .replace('#include <opaque_fragment>', `{
  highp vec3 gV = normalize( vViewPosition );
  highp vec3 gN = normalize( normal );
  highp vec3 gR = normalize( inverseTransformDirection( reflect( -gV, gN ), viewMatrix ) );
  highp float gH = gR.y;
  highp float gUp = smoothstep( 0.0, 1.0, clamp( gH, 0.0, 1.0 ) );
  highp vec3 gSky = mix( uGlassHorizon, uGlassZenith, pow( gUp, 0.65 ) ) * 0.75;
  gSky = mix( gSky, uGlassGround, smoothstep( 0.0, 0.45, -gH ) );
  highp float gSd = max( dot( gR, normalize( uGlassSunDir ) ), 0.0 );
  gSky += uGlassSunColor * ( pow( gSd, 28.0 ) * 0.45 + pow( gSd, 5.0 ) * 0.12 );
  highp float gS = gR.x * 0.5 + gH - 0.32;
  gSky += vec3( 0.07 ) * exp( -gS * gS * 18.0 );
  highp float gS2 = gR.x * 0.8 + gH * 0.6 - 0.12;
  gSky += vec3( 0.10 ) * exp( -gS2 * gS2 * 260.0 );
#ifdef USE_COLOR
  gSky *= vColor.rgb;
#endif
  highp float gF = pow( 1.0 - clamp( dot( gN, gV ), 0.0, 1.0 ), 3.0 );
  outgoingLight = mix( outgoingLight, gSky * ( 0.9 + 0.2 * gF ), clamp( uGlassMix + 0.1 * gF, 0.0, 0.55 ) );
}
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'stylised-glass-smooth-2';
  material.needsUpdate = true;
  return { uniforms: u, update };
}
