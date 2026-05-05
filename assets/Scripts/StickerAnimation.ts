// FILE: /assets/Scripts/StickerAnimation.ts (Corrected for Method A)

import { _decorator, Component, Node, Sprite, SpriteFrame, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('StickerAnimation')
export class StickerAnimation extends Component {
    // These frames are the ones you drag in via the Inspector
    @property([SpriteFrame])
    frames: SpriteFrame[] = [];

    @property
    frameDuration: number = 0.05; // You can adjust this speed

    private sprite: Sprite | null = null;
    private currentIndex: number = 0;
    private onCompleteCallback: (() => void) | null = null;

    onLoad() {
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error("StickerAnimation requires a Sprite component on the same node.");
        }
    }
    
    /**
     * Plays the animation using the frames already attached to this component.
     * @param onComplete An optional function to call when the animation finishes.
     */
 

public playAnimation(onComplete?: () => void) {
    console.log("STICKER ANIMATION: Play requested on node '" + this.node.name + "'.");

    if (!this.sprite || this.frames.length === 0) {
        console.error("Cannot play animation: Sprite component is missing or 'Frames' array is empty!");
        onComplete?.();
        return;
    }
    console.log("Playing animation with " + this.frames.length + " frames.");

    this.unschedule(this.nextFrame);
    this.currentIndex = 0;
    this.onCompleteCallback = onComplete || null;
    this.sprite.spriteFrame = this.frames[this.currentIndex];
    this.schedule(this.nextFrame, this.frameDuration);
}
    private nextFrame() {
        this.currentIndex++;
        if (this.currentIndex >= this.frames.length) {
            // Animation finished
            this.unschedule(this.nextFrame);
            this.onCompleteCallback?.();
        } else {
            // Show the next frame
            if (this.sprite) {
                this.sprite.spriteFrame = this.frames[this.currentIndex];
            }
        }
    }
}