import vBase from "../glsl/base.vert";
import fImage from "../glsl/dest.frag";
import { Func } from '../core/func';
import { Canvas } from '../webgl/canvas';
import { Object3D } from 'three/src/core/Object3D';
import { Update } from '../libs/update';
import { MatterjsMgr } from './matterjsMgr';
import { Mesh } from 'three/src/objects/Mesh';
import { CircleGeometry } from 'three/src/geometries/CircleGeometry';
import { Vector3 } from 'three/src/math/Vector3';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Param } from "../core/param";
import { Capture } from "../webgl/capture";
import { Blur } from "../webgl/blur";
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide } from 'three/src/constants';
import { Conf } from "../core/conf";
import { Texture } from "three/src/textures/Texture";
import { Util } from "../libs/util";
import { MousePointer } from "../core/mousePointer";


export class Visual extends Canvas {

  private _con:Object3D;
  private _conDest:Object3D;
  private _matterjs:MatterjsMgr;
  private _item:Array<Array<any>> = [];

  private _blurCap:Capture;
  private _blur:Array<Blur> = [];
  private _blurCamera:OrthographicCamera;

  private _dest:Array<Mesh> = [];

  constructor(opt: any) {
    super(opt);

    Param.instance.debug

    this._matterjs = opt.matterjs;

    this._con = new Object3D();

    this._conDest = new Object3D();
    this.mainScene.add(this._conDest);

    this._blurCap = new Capture();
    this._blurCap.add(this._con);

    this._blurCamera = this._makeOrthCamera()
    this._updateOrthCamera(this._blurCamera, 10, 10)

    for(let i = 0; i < 3; i++) {
      const b = new Blur()
      this._blur.push(b)
    }

    const geo = new CircleGeometry(0.5, 32);

    this._matterjs.lineBodies.forEach((val,i) => {
      this._item.push([])
      val.forEach(() => {
        const mesh = new Mesh(
          geo,
          new MeshBasicMaterial({
            color: 0xffffff,
            transparent:true,
            depthTest:false,
          })
        )
        this._con.add(mesh);

        this._item[i].push({
          mesh:mesh,
          noise:new Vector3(Util.instance.random(0, 1), Util.instance.random(0, 1), Util.instance.random(0, 1))
        });
      })
    })

    for(let i = 0; i < 6; i++) {
      const dest = new Mesh(
        new PlaneGeometry(1, 1),
        new ShaderMaterial({
          vertexShader:vBase,
          fragmentShader:fImage,
          transparent:true,
          side:DoubleSide,
          depthTest:false,
          uniforms:{
            tDiffuse:{value:this._blur[this._blur.length - 1].getTexture()},
            alpha:{value:1},
            color:{value:Util.instance.randomArr(Conf.instance.COLOR)},
            time:{value:Util.instance.randomInt(0, 1000)},
            bright:{value:0},
            contrast:{value:1},
          }
        })
      )
      this._conDest.add(dest);
      this._dest.push(dest);
    }


    // this._dest.rotation.x = Util.instance.radian(90);
    // this._conDest.rotation.x = Util.instance.radian(45);
    // this._conDest.rotation.y = Util.instance.radian(-45);

    this._resize()
  }


  protected _update(): void {
    super._update()

    this._conDest.position.y = Func.instance.screenOffsetY() * -1;

    const sw = Func.instance.sw()
    const sh = Func.instance.sh()

    const b = this._matterjs.lineBodies[0];
    const bridgeSize = (sw / b.length) * 0.5;

    this._matterjs.lineBodies.forEach((val,i) => {
      val.forEach((val2,l) => {
        let bodyX = val2.position.x - sw * 0.5
        let bodyY = val2.position.y * -1 + sh * 0.5

        const item = this._item[i][l];
        const mesh = item.mesh;
        mesh.position.x = bodyX;
        mesh.position.y = bodyY;

        const noise = item.noise;

        const size = bridgeSize * Func.instance.val(1.5, 1);
        mesh.scale.set(size * Util.instance.mix(2, 5, noise.x), size * Util.instance.mix(2, 5, noise.y), 1);
      })
    })

    this._conDest.rotation.x = Util.instance.radian(MousePointer.instance.easeNormal.y * 180);
    this._conDest.rotation.y = Util.instance.radian(MousePointer.instance.easeNormal.x * 180);
    // this._conDest.rotation.z = Util.instance.radian(MousePointer.instance.easeNormal.x * MousePointer.instance.easeNormal.y * 45);

    const destSize = Math.min(sw, sh) * 0.25 * Util.instance.map(MousePointer.instance.easeNormal.y, 1, 2, -1, 1);
    this._conDest.scale.set(destSize, destSize, destSize);

    // 立方体上に配置
    const size = 0.5;
    this._dest[0].position.y = size;
    this._dest[0].rotation.x = Util.instance.radian(-90);

    this._dest[1].position.y = -size;
    this._dest[1].rotation.x = Util.instance.radian(90);

    this._dest[2].position.z = -size;

    this._dest[3].position.z = size;

    this._dest[4].position.x = -size;
    this._dest[4].rotation.y = Util.instance.radian(90);

    this._dest[5].position.x = size;
    this._dest[5].rotation.y = Util.instance.radian(-90);

    this._dest.forEach((val) => {
      this._getUni(val).time.value += 1;
    })

    if (this.isNowRenderFrame()) {
      this._render()
    }
  }


  private _render(): void {

    // ブラー適応
    this.renderer.setClearColor(0x000000, 0)
    this._blurCap.render(this.renderer, this.cameraPers);
    const bw = this.renderSize.width * Conf.instance.BLUR_SCALE
    const bh = this.renderSize.height * Conf.instance.BLUR_SCALE
    this._blur.forEach((val,i) => {
        const t:Texture = i == 0 ? this._blurCap.texture() : this._blur[i-1].getTexture()
        val.render(bw, bh, t, this.renderer, this._blurCamera, 100)
    })

    this.renderer.setClearColor(0xffffff, 1)
    this.renderer.render(this.mainScene, this.cameraPers);
  }


  public isNowRenderFrame(): boolean {
    return this.isRender && Update.instance.cnt % 1 == 0
  }


  _resize(isRender: boolean = true): void {
    super._resize();

    const w = Func.instance.sw();
    const h = Func.instance.sh();

    this.renderSize.width = w;
    this.renderSize.height = h;

    // this._updateOrthCamera(this.cameraOrth, w, h);
    this._updatePersCamera(this.cameraPers, w, h);

    let pixelRatio: number = window.devicePixelRatio || 1;

    // const kake = Func.instance.val(2, 1.25)

    // this._conDest.position.z = this.cameraPers.position.z

    this._blurCap.setSize(w, h, pixelRatio)
    this._updateOrthCamera(this._blurCamera, w * Conf.instance.BLUR_SCALE, h * Conf.instance.BLUR_SCALE)


    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.clear();

    if (isRender) {
      this._render();
    }
  }
}
