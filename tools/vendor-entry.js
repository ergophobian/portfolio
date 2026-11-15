// Single-file three.js bundle for the portfolio world (WebGPU renderer with automatic WebGL 2 fallback).
export * from 'three/webgpu';
export * as TSL from 'three/tsl';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
export { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
export * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
export * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
export { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { ao } from 'three/addons/tsl/display/GTAONode.js';
export { bloom } from 'three/addons/tsl/display/BloomNode.js';
export { fxaa } from 'three/addons/tsl/display/FXAANode.js';
export { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
