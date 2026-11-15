// Post-processing: ambient occlusion (high tier), bloom, vignette, tone mapping and FXAA.
import * as THREE from '../vendor/three.bundle.min.js';
import { TSL, ao, bloom, fxaa, denoise } from '../vendor/three.bundle.min.js';

const { pass, mrt, output, normalView, screenUV, smoothstep, renderOutput, vec3, float } = TSL;

export function createPipeline(renderer, scene, camera, quality) {
  if (!quality.post) return null;
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: 0 });
  let color = scenePass.getTextureNode('output');

  if (quality.ao) {
    scenePass.setMRT(mrt({ output, normal: normalView }));
    const depth = scenePass.getTextureNode('depth');
    const normal = scenePass.getTextureNode('normal');
    const aoPass = ao(depth, normal, camera);
    aoPass.resolutionScale = 0.5;
    aoPass.radius.value = 0.55;
    aoPass.thickness.value = 1.2;
    aoPass.samples.value = 12;
    const smooth = denoise(aoPass.getTextureNode(), depth, normal, camera);
    // Keep occlusion subtle so grass and foliage do not turn muddy.
    color = color.mul(smooth.r.mul(0.82).add(0.18));
  }

  const glow = bloom(color, quality.ao ? 0.22 : 0.18, 0.55, 0.94);
  let out = color.add(glow);
  const d = screenUV.sub(0.5).length();
  out = out.mul(smoothstep(float(0.98), float(0.36), d).mul(0.22).add(0.78));
  // Slight warm lift, then tone map + convert to display space before anti-aliasing.
  out = out.mul(vec3(1.02, 1.0, 0.97));
  pipeline.outputColorTransform = false;
  pipeline.outputNode = fxaa(renderOutput(out));
  return pipeline;
}
