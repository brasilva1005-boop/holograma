import type { Vec2 } from './prism';

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aScreenUv;
out vec2 vScreenUv;
void main() {
  vScreenUv = aScreenUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uCenter;
uniform float uMagnification;
uniform float uTime;
uniform float uFold;
in vec2 vScreenUv;
out vec4 outColor;

vec3 thermal(float t) {
  vec3 cyan = vec3(0.0, 0.941, 1.0);
  vec3 green = vec3(0.224, 1.0, 0.078);
  vec3 yellow = vec3(1.0, 0.902, 0.0);
  vec3 magenta = vec3(1.0, 0.0, 0.498);

  if (t < 0.333) return mix(cyan, green, t / 0.333);
  if (t < 0.666) return mix(green, yellow, (t - 0.333) / 0.333);
  return mix(yellow, magenta, (t - 0.666) / 0.334);
}

void main() {
  vec2 warped = uCenter + (vScreenUv - uCenter) / uMagnification;
  warped = clamp(warped, vec2(0.001), vec2(0.999));

  // A textura de vídeo chega sem espelhamento; o eixo X é invertido aqui
  // para coincidir com a selfie mostrada no canvas final.
  vec2 sourceUv = vec2(1.0 - warped.x, warped.y);
  vec3 src = texture(uVideo, sourceUv).rgb;

  float luma = dot(src, vec3(0.2126, 0.7152, 0.0722));
  float chroma = max(src.r, max(src.g, src.b)) - min(src.r, min(src.g, src.b));
  float sweep = 0.10 * sin((vScreenUv.x * 7.0 + vScreenUv.y * 4.5) + uFold * 2.4);
  float heatPosition = clamp(luma * 0.72 + chroma * 0.38 + sweep + 0.08, 0.0, 1.0);
  vec3 heat = thermal(heatPosition);

  // Mantém detalhes reais da pele/ambiente, mas com contraste térmico vibrante.
  vec3 boosted = pow(max(src, vec3(0.0)), vec3(0.88));
  vec3 color = mix(boosted, heat, 0.58);
  color = (color - 0.5) * 1.22 + 0.5;

  // Reflexo de vidro limpo: uma faixa especular contínua, sem ruído/glitch.
  float diagonal = vScreenUv.x * 0.95 + vScreenUv.y * 0.62 + uTime * 0.045;
  float stripe = abs(fract(diagonal) - 0.5);
  float specular = pow(max(0.0, 1.0 - stripe * 11.0), 7.0);
  color += vec3(0.82, 0.95, 1.0) * specular * 0.22;

  // Fresnel leve nas regiões mais afastadas do centro óptico.
  float fresnel = smoothstep(0.08, 0.62, distance(vScreenUv, uCenter));
  color += vec3(0.08, 0.20, 0.24) * fresnel * 0.16;

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Não foi possível criar shader WebGL.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Erro desconhecido de shader.';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Não foi possível criar programa WebGL.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Erro desconhecido ao linkar shader.';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

export class ThermalShaderRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uCenter: WebGLUniformLocation;
  private readonly uMagnification: WebGLUniformLocation;
  private readonly uTime: WebGLUniformLocation;
  private readonly uFold: WebGLUniformLocation;
  private textureWidth = 0;
  private textureHeight = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 não está disponível neste navegador.');
    this.gl = gl;
    this.program = createProgram(gl);

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!vao || !buffer || !texture) throw new Error('Falha ao iniciar recursos WebGL.');
    this.vao = vao;
    this.texture = texture;

    // position.xy + screenUv.xy — dois triângulos cobrindo o quadro inteiro.
    const vertices = new Float32Array([
      -1,  1, 0, 0,
      -1, -1, 0, 1,
       1,  1, 1, 0,
       1,  1, 1, 0,
      -1, -1, 0, 1,
       1, -1, 1, 1,
    ]);

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.useProgram(this.program);
    const videoLocation = gl.getUniformLocation(this.program, 'uVideo');
    this.uCenter = gl.getUniformLocation(this.program, 'uCenter')!;
    this.uMagnification = gl.getUniformLocation(this.program, 'uMagnification')!;
    this.uTime = gl.getUniformLocation(this.program, 'uTime')!;
    this.uFold = gl.getUniformLocation(this.program, 'uFold')!;
    gl.uniform1i(videoLocation, 0);
  }

  resize(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  render(video: HTMLVideoElement, centerPx: Vec2, fold: number, nowMs: number): void {
    const gl = this.gl;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (this.textureWidth !== video.videoWidth || this.textureHeight !== video.videoHeight) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      this.textureWidth = video.videoWidth;
      this.textureHeight = video.videoHeight;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    gl.uniform2f(
      this.uCenter,
      centerPx.x / Math.max(1, this.canvas.width),
      centerPx.y / Math.max(1, this.canvas.height),
    );
    gl.uniform1f(this.uMagnification, 1.08);
    gl.uniform1f(this.uTime, nowMs / 1000);
    gl.uniform1f(this.uFold, fold);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
