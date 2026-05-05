import { _decorator, Component, Node, tween, Vec3, UIOpacity, Tween, CCFloat } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('TutorialHandController')
export class TutorialHandController extends Component {

    @property({ 
        type: Node,
        tooltip: "The node of the 'idle' hand sprite (e.g., BubbleIdle)."
    })
    public idleSpriteNode: Node = null;

    @property({ 
        type: Node,
        tooltip: "The node of the 'click' hand sprite (e.g., BubbleClick)."
    })
    public clickSpriteNode: Node = null;

    @property({ 
        type: CCFloat,
        tooltip: "The vertical distance the hand moves down when it 'clicks'."
    })
    public moveDistance: number = -2000; // A negative value for moving down
    
    @property({ 
        type: CCFloat,
        tooltip: "The total duration of one full press-and-release cycle in seconds."
    })
    public duration: number = 1.2;

    private handTween: Tween<Node> | null = null;
    private initialPos: Vec3 = new Vec3();

    onLoad() {
        this.initialPos.set(this.node.position);
    }

    /**
     * Starts the repeating press-and-release animation loop.
     */
    public startAnimation() {
        if (!this.idleSpriteNode || !this.clickSpriteNode) {
            console.error("Idle or Click sprite node is not assigned in TutorialHandController!");
            return;
        }

        // Ensure the correct starting state
        this.node.active = true;
        this.idleSpriteNode.active = true;
        this.clickSpriteNode.active = false;
        this.node.setPosition(this.initialPos);

        const halfDuration = this.duration / 2;

        // Create a looping tween
        this.handTween = tween(this.node)
            .sequence(
                // Press down part of the animation
                tween().to(halfDuration, { position: new Vec3(this.initialPos.x, this.initialPos.y + this.moveDistance, this.initialPos.z) }, {
                    easing: 'cubicOut',
                    onStart: () => {
                        // Swap to the 'click' sprite
                        this.idleSpriteNode.active = false;
                        this.clickSpriteNode.active = true;
                    }
                }),
                // Release part of the animation
                tween().to(halfDuration, { position: this.initialPos }, {
                    easing: 'cubicIn',
                    onStart: () => {
                        // Swap back to the 'idle' sprite
                        this.idleSpriteNode.active = true;
                        this.clickSpriteNode.active = false;
                    }
                })
            )
            .delay(0.2) // Pause between presses
            .union()
            .repeatForever()
            .start();
    }
    
    /**
     * Immediately stops any running animations and hides the hand node.
     */
    public stopAndHide() {
        if (this.handTween) {
            this.handTween.stop();
            this.handTween = null;
        }
        this.node.active = false;
    }

    /**
     * Shows the 'click' state for a brief moment and then fades out.
     * This is called by the UI Controller when the button is actually clicked.
     */
    public showClickEffect() {
        this.stopAndHide(); // Stop the looping animation

        // Manually set the hand to its 'clicked' state
        this.node.active = true;
        this.idleSpriteNode.active = false;
        this.clickSpriteNode.active = true;
        this.node.setPosition(new Vec3(this.initialPos.x, this.initialPos.y + this.moveDistance, this.initialPos.z));

        // Get or add a UIOpacity component to fade the hand out
        const opacity = this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity);
        opacity.opacity = 255;

        // Animate the fade out
        tween(opacity)
            .delay(0.1) // Hold the click state for a moment
            .to(0.2, { opacity: 0 })
            .call(() => {
                this.node.active = false; // Hide completely after fading
            })
            .start();
    }
}