import { _decorator, Component, Node, tween, v3, Vec3, Tween, SpriteFrame, Sprite, UITransform, input, Input, EventTouch, EventMouse } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TutorialController')
export class TutorialController extends Component {
    @property({ type: Node, tooltip: "The hand sprite node that will be animated." })
    public handNode: Node | null = null;

    @property({ type: SpriteFrame, tooltip: "The sprite for the idle/pointing hand." })
    public idleHandSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: "The sprite for the hand when it is 'clicked down'." })
    public clickHandSprite: SpriteFrame | null = null;

    private handTween: Tween<Node> | null = null;

    onEnable() {
        // We make the tutorial stop on ANY player input.
        input.on(Input.EventType.TOUCH_START, this.stopTutorial, this);
        input.on(Input.EventType.MOUSE_DOWN, this.stopTutorial, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.stopTutorial, this);
        input.off(Input.EventType.MOUSE_DOWN, this.stopTutorial, this);
        this.stopTutorial(); // Ensure it's cleaned up when the component is disabled
    }

    public stopTutorial(): void {
        if (this.handTween) {
            this.handTween.stop();
            this.handTween = null;
        }
        if (this.handNode) {
            this.handNode.active = false;
        }
    }

    /**
     * Plays the original A-to-B drag tutorial.
     */
   // FILE: TutorialController.ts

// REPLACEMENT for playDragTutorial
public playDragTutorial(startNode: Node, endNode: Node): void {
    if (!this.handNode || !this.idleHandSprite || !this.clickHandSprite || !startNode.isValid || !endNode.isValid) return;

    this.stopTutorial(); // Stop any previous tutorial
    this.handNode.active = true;
    const handSprite = this.handNode.getComponent(Sprite);
    
    const startPosition = this.getUIPosition(startNode);
    const endPosition = this.getUIPosition(endNode);
    if (!startPosition || !endPosition) { this.stopTutorial(); return; }

    this.handNode.setPosition(startPosition);

    // === NEW AND CORRECT LOOPING TWEEN ===
    this.handTween = tween(this.handNode)
        .repeatForever(
            tween()
                // --- Part 1: Animate from Start to End ---
                .call(() => {
                    if (handSprite) handSprite.spriteFrame = this.idleHandSprite;
                    this.handNode.setPosition(startPosition); // Reset position at the start of each loop
                })
                .delay(0.5) // Pause on start item
                .call(() => { if (handSprite) handSprite.spriteFrame = this.clickHandSprite; })
                .to(1.5, { position: endPosition }, { easing: 'sineInOut' })
                .call(() => { if (handSprite) handSprite.spriteFrame = this.idleHandSprite; })

                // --- Part 2: Animate from End back to Start ---
                .delay(0.5) // Pause on end item
                // This section is what was missing for the continuous feel.
                // It just waits at the end, making it feel like it goes back instantly.
                // A smooth return can be added if you prefer.
                // For example: .to(1.5, { position: startPosition }, { easing: 'sineInOut' })
        )
        .start();
}

    /**
     * Plays a tapping/clicking animation on a single target node.
     */
    public playClickTutorial(targetNode: Node): void {
        if (!this.handNode || !this.idleHandSprite || !this.clickHandSprite || !targetNode.isValid) return;

        this.stopTutorial();
        this.handNode.active = true;
        const handSprite = this.handNode.getComponent(Sprite);

        const targetPosition = this.getUIPosition(targetNode);
        if (!targetPosition) { this.stopTutorial(); return; }
        
        // This offset positions the hand nicely to the bottom right of the button. Adjust as needed.
        targetPosition.add(new Vec3(20, -20, 0)); 
        this.handNode.setPosition(targetPosition);

        this.handTween = tween(this.handNode)
            .call(() => { if (handSprite) handSprite.spriteFrame = this.idleHandSprite; })
            .delay(0.6)
            .call(() => { if (handSprite) handSprite.spriteFrame = this.clickHandSprite; })
            .delay(0.3)
            .union()
            .repeatForever()
            .start();
    }
    
    private getUIPosition(targetNode: Node): Vec3 | null {
        const referenceNode = this.handNode?.parent;
        if (!referenceNode || !targetNode.isValid) return null;

        const refUIT = referenceNode.getComponent(UITransform);
        const targetUIT = targetNode.getComponent(UITransform);
        if (!refUIT || !targetUIT) return null;

        const worldPos = targetUIT.convertToWorldSpaceAR(v3(0, 0, 0));
        return refUIT.convertToNodeSpaceAR(worldPos);
    }
}