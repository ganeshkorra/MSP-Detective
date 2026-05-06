import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ScaleInOut')
export class ScaleInOut extends Component {

    onLoad() {
        this.playLoopAnimation();
    }

   playLoopAnimation() {
    tween(this.node)
        .repeatForever(
            tween()
                .to(0.5, { scale: new Vec3(0.396, 0.396, 0.396) }, { easing: 'sineOut' })
                .to(0.5, { scale: new Vec3(0.436, 0.436, 0.436) }, { easing: 'sineIn' })
        )
        .start();
}
}