import * as T from 'three';

export function createSky(scene) {
  scene.fog = new T.FogExp2(0xae8290, .0027);
  const sky = new T.Mesh(new T.SphereGeometry(1050, 28, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { time: { value: 0 }, day: { value: 1 }, sun: { value: new T.Vector3() } },
    vertexShader: 'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec3 d; uniform float time,day; uniform vec3 sun;
      float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(grain(i),grain(i+vec2(1,0)),f.x),mix(grain(i+vec2(0,1)),grain(i+1.),f.x),f.y);}
      void main(){
        vec3 v=normalize(d); float h=max(0.,v.y);
        vec3 zenith=mix(vec3(.035,.05,.13),vec3(.20,.33,.54),day);
        vec3 horizon=mix(vec3(.16,.13,.26),vec3(.76,.44,.46),day);
        vec3 c=mix(horizon,zenith,pow(h,.51));
        float s=max(0.,dot(v,sun)); c+=pow(s,20.)*vec3(.34,.13,.08)*day;
        c+=smoothstep(.9976,.999,s)*vec3(1.,.71,.47)*day;
        vec2 p=v.xz/(max(.1,h)+.15)*2.1+vec2(time*.009,0.);
        float cloud=noise(p)*.65+noise(p*2.4)*.25+noise(p*5.)*.1;
        c=mix(c,mix(vec3(.24,.23,.39),vec3(.95,.64,.61),day),smoothstep(.47,.72,cloud)*smoothstep(.015,.22,h)*.57);
        float stars=pow(grain(floor(v.xz/(h+.1)*710.)),115.)*smoothstep(.14,.40,h);
        c+=stars*(1.-day)*.48;
        gl_FragColor=vec4(c,1.);
      }`
  }));
  sky.renderOrder = -10; scene.add(sky);
  const hemi = new T.HemisphereLight(0xb7ceff, 0x644354, 2.4); scene.add(hemi);
  const light = new T.DirectionalLight(0xffcc9f, 3.1);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, far: 210 });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -.0003; light.shadow.normalBias = .12;
  scene.add(light, light.target);
  const sun = new T.Vector3(), night = new T.Color(0x5075d0), warm = new T.Color(0xffc28b);
  const fogNight = new T.Color(0x343453), fogDay = new T.Color(0xb18c9b);
  return (time, center, eye, cycle) => {
    const phase = .64 + (cycle ? time / 108 * Math.PI * 2 : 0);
    const altitude = Math.sin(phase) * .67;
    const day = T.MathUtils.smoothstep(altitude, -.28, .48);
    sun.set(-.65 * Math.cos(phase), altitude + .05, -.74 * Math.cos(phase)).normalize();
    sky.position.copy(eye);
    Object.assign(sky.material.uniforms.time, { value: time });
    sky.material.uniforms.day.value = day; sky.material.uniforms.sun.value.copy(sun);
    hemi.intensity = 1.18 + 1.4 * day;
    light.color.copy(night).lerp(warm, day); light.intensity = .7 + 2.5 * day;
    light.target.position.copy(center);
    light.position.copy(center).addScaledVector(sun, 65); light.position.y += 28;
    scene.fog.color.copy(fogNight).lerp(fogDay, day);
    return day;
  };
}
