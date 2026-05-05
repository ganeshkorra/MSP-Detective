// FILE: /assets/Scripts/CollectionTrackerUI.ts (Final Version)

import { _decorator, Component, Node, Label, UITransform, tween, Vec3, UIOpacity, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CollectionTrackerUI')
export class CollectionTrackerUI extends Component {
    @property({ type: Label, tooltip: "The UI Label component that will display the progress text." })
    public progressLabel: Label = null;
    @property({ type: Node, tooltip: "The colored 'filled' part of the progress bar that will be moved." })
    public progressBarFilledNode: Node = null;
    @property({ type: Node, tooltip: "A 'lock' icon node to show when inactive. Can be empty."})
    public lockIcon: Node | null = null;
    @property({ type: Node, tooltip: "A 'checkmark' icon node to show when completed. Can be empty."})
    public checkmarkIcon: Node | null = null;

    private uiOpacity: UIOpacity = null;
    private progressBarWidth: number = 0;

    onLoad() {
        this.uiOpacity = this.getComponent(UIOpacity);
        if (!this.uiOpacity) {
            this.uiOpacity = this.addComponent(UIOpacity);
        }
        if (this.progressBarFilledNode) {
            const uiTransform = this.progressBarFilledNode.getComponent(UITransform);
            if(uiTransform) {
                this.progressBarWidth = uiTransform.width;
            }
        }
        if (this.lockIcon) this.lockIcon.active = false;
        if (this.checkmarkIcon) this.checkmarkIcon.active = false;
    }

    public setStateLocked() {
        if (this.uiOpacity) this.uiOpacity.opacity = 100;
        if (this.lockIcon) this.lockIcon.active = true;
        if (this.checkmarkIcon) this.checkmarkIcon.active = false;
    }

    public setStateActive(shouldAnimate: boolean) {
        if (this.uiOpacity) this.uiOpacity.opacity = 255;
        if (this.lockIcon) this.lockIcon.active = false;
        if (this.checkmarkIcon) this.checkmarkIcon.active = false;

        if (shouldAnimate) {
            tween(this.node).stop();
            this.node.setScale(new Vec3(0.6, 0.6, 1));
            tween(this.node)
                .to(0.5, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'backOut' })
                .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
                .start();
        }
    }

    public setStateCompleted() {
        if (this.uiOpacity) this.uiOpacity.opacity = 255;
        if (this.lockIcon) this.lockIcon.active = false;
        if (this.checkmarkIcon) this.checkmarkIcon.active = true;
        
        if(this.checkmarkIcon){
            this.checkmarkIcon.setScale(new Vec3(0, 0, 0));
            tween(this.checkmarkIcon).to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    }

    public updateProgress(current: number, max: number) {
        if (this.progressLabel) {
            this.progressLabel.string = `${current}/${max}`;
        }
        if (this.progressBarFilledNode && this.progressBarWidth > 0) {
            const fillRatio = max > 0 ? current / max : 0;
            const targetX = -this.progressBarWidth + (this.progressBarWidth * fillRatio);
            tween(this.progressBarFilledNode)
                .to(0.3, { position: new Vec3(targetX, this.progressBarFilledNode.position.y, 0) }, { easing: 'cubicOut' })
                .start();
        }
    }

    public playCollectionEffect() {
        tween(this.node).stop();
        tween(this.node)
            .to(0.1, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'quadOut' })
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'bounceOut' })
            .start();
    }
    
    public playCompletionAnimationAndHide() {
        tween(this.node).stop();
        tween(this.node)
            .parallel(
                tween().to(0.4, { scale: new Vec3(0, 0, 0) }, { easing: 'backIn' }),
                tween(this.getComponent(UIOpacity)).to(0.4, { opacity: 0 }, { easing: 'quadIn' })
            )
            .call(() => {
                this.node.active = false; 
            })
            .start();
    }
}