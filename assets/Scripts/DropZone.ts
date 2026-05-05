// DropZone.ts (with a new "Pulse Blink" hint)
import { _decorator, Component, Node, CCString, Sprite, Color, Tween, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('DropZone')
export class DropZone extends Component {
    @property(CCString) public id: string = "";
     @property({ 
        type: Number, 
        tooltip: "The render order. Higher numbers appear in front." 
    })
    public depth: number = 0;

    // All other properties are unchanged.

    private originalColor: Color = new Color();
    private blinkTween: Tween<Sprite> | null = null;

    onLoad() {
        const sprite = this.getComponent(Sprite);
        if (sprite) {
            this.originalColor.set(sprite.color);
        }
    }

    // --- NEW FUNCTION: The elegant "Pulse" or "Burst" Blink ---
    /**
     * Plays a rare, pulsing blink animation. Blinks twice, then pauses for a long time.
     * Perfect for the initial hint.
     */
    // public startInitialHintBlink(): void {
    //     const sprite = this.getComponent(Sprite);
    //     if (!sprite || this.blinkTween) return;

    //     const hintColor = new Color(255, 255, 150, 255);
        
    //     this.blinkTween = tween(sprite)
    //         // First blink in the burst
    //         .to(0.4, { color: hintColor }, { easing: 'sineOut' })
    //         .to(0.4, { color: this.originalColor }, { easing: 'sineIn' })
    //         .delay(0.2) // Short pause
    //         // Second blink in the burst
    //         .to(0.4, { color: hintColor }, { easing: 'sineOut' })
    //         .to(0.4, { color: this.originalColor }, { easing: 'sineIn' })
    //         // The long pause before the next burst
    //         .delay(4.0)
    //         .union()
    //         .repeatForever()
    //         .start();
    // }
    
    // --- RENAMED OLD FUNCTION: The continuous "ugly" blink ---
    /**
     * Plays a continuous, steady blink.
     * Used for the regular idle hint after the game has started.
     */
    // public startIdleHintBlink(): void {
    //     const sprite = this.getComponent(Sprite);
    //     if (!sprite || this.blinkTween) return;

    //     this.blinkTween = tween(sprite)
    //         .to(0.5, { color: new Color(255, 255, 150, 255) }, { easing: 'sineOut' })
    //         .to(0.5, { color: this.originalColor }, { easing: 'sineIn' })
    //         .union()
    //         .repeatForever()
    //         .start();
    // }

    // public stopBlinking(): void {
    //     if (this.blinkTween) {
    //         this.blinkTween.stop();
    //         this.blinkTween = null;
    //     }
    //     const sprite = this.getComponent(Sprite);
    //     if (sprite) {
    //         sprite.color = this.originalColor;
    //     }
    // }
    
    // hideZone() and any other functions are unchanged.
    private pulseTween: Tween<Node> | null = null;
    private cachedScale: Vec3 | null = null;

public startPulsingHint(): void {
    if (this.pulseTween) return; // Already pulsing

    // Cache the original scale so we can reset it when stopping
    this.cachedScale = this.node.scale.clone();
    const originalScale = this.cachedScale;
    const targetScale = originalScale.clone().multiplyScalar(1.08); // Pulse 8% larger

    // Pulse (scale up then down), then wait 2 seconds before the next pulse
    this.pulseTween = tween(this.node)
        .to(0.6, { scale: targetScale }, { easing: 'sineInOut' })
        .to(0.6, { scale: originalScale }, { easing: 'sineInOut' })
        .delay(2.0)
        .union()
        .repeatForever()
        .start();
}

public stopPulsingHint(): void {
    if (this.pulseTween) {
        this.pulseTween.stop();
        this.pulseTween = null;
    }

    // Restore the original scale if we cached it
    if (this.cachedScale) {
        this.node.scale = this.cachedScale.clone();
        this.cachedScale = null;
    }
}
}