// Cloud.ts
import { _decorator, Component, Node, tween, Vec3, v3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Cloud')
export class Cloud extends Component {
    // This will store the cloud's original position from the editor
    private originalPosition: Vec3 = new Vec3();

    /**
     * The start() method is a built-in Cocos Creator lifecycle function.
     * It runs automatically once for this component when it becomes active in the scene.
     */
    start() {
        // Record the initial position where the cloud was placed in the editor
        this.originalPosition.set(this.node.position);
        
        // Immediately start the infinite bobbing animation
        this.startBobbingAnimation();
    }

    /**
     * Creates and starts a continuous, gentle up-and-down tween animation.
     */
    private startBobbingAnimation() {
        // --- Animation Parameters for a Natural Feel ---

        // The maximum distance (in pixels) the cloud will move up or down from its start position
        const moveAmount = 20; 
        
        // Give each cloud a slightly random duration for one animation cycle (between 3 and 5 seconds)
        // This prevents all clouds from moving in perfect, unnatural sync.
        const duration = 1 + Math.random() * 2; 

        // The animation sequence
        tween(this.node)
            // Start with a small random delay (0 to 1 second) to further de-synchronize the clouds
            .delay(Math.random())
            
            // Animate moving UP
            .to(duration, { position: v3(this.originalPosition.x, this.originalPosition.y + moveAmount, this.originalPosition.z) }, { easing: 'sineInOut' })
            
            // Animate moving back DOWN
            .to(duration, { position: v3(this.originalPosition.x, this.originalPosition.y - moveAmount, this.originalPosition.z) }, { easing: 'sineInOut' })
            
            // .union() chains the animations one after another
            .union()

            // .repeatForever() makes the entire sequence loop indefinitely
            .repeatForever()
            
            // Start the animation
            .start();
    }
}