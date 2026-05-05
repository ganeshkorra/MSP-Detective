import { _decorator, Component, Node, CCString,ParticleSystem2D, tween, Vec3, instantiate, Prefab } from 'cc';
import { DropZone } from './DropZone';

const { ccclass, property } = _decorator;

@ccclass('CompletableItem')
export class CompletableItem extends Component {
    @property({ type: CCString }) public itemId: string = "";
    @property({ type: [DropZone] }) public dropZones: DropZone[] = [];
    @property({ type: Node }) public rewardDiamond: Node = null;
      // --- NEW PROPERTY FOR THE PARTICLE EFFECT ---
  @property({ type: Prefab }) public celebrationParticles: Prefab = null;
onLoad() {
    if (this.rewardDiamond) { this.rewardDiamond.active = false; }
}
public checkCompletion(): boolean {
        // This line checks if EVERY drop zone in its list is inactive.
        return this.dropZones.every(zone => !zone.node.active);
    }

     public showReward(scoreLabelNode: Node): void {
        console.log("DEBUG: showReward() called for item:", this.itemId);

        if (!this.rewardDiamond || !scoreLabelNode) {
            console.error("ERROR: Reward Diamond or Score Label is not set for item:", this.itemId);
            return;
        }

        const startPos = this.rewardDiamond.getWorldPosition();
        
        // --- Play Particle Effect ---
        if (this.celebrationParticles) {
            console.log("DEBUG: Celebration Particles prefab exists. Attempting to instantiate.");

            let particleNode: Node | null = null;
            try {
                particleNode = instantiate(this.celebrationParticles);
            } catch (e) {
                console.error("ERROR: Failed to instantiate particle prefab.", e);
            }

            if (particleNode) {
                this.node.scene.addChild(particleNode);
                particleNode.setWorldPosition(startPos);
                
                const particles = particleNode.getComponent(ParticleSystem2D);
                if (particles) {
                    console.log("DEBUG: Particle system component found. Resetting and playing.");
                    // Stop, clear, and restart the system to ensure it plays from frame 0.
                    particles.stopSystem();
                    particles.clear();
                    particles.resetSystem();
                    // Note: 'resetSystem()' often triggers 'Play On Load', but calling play() is a safer guarantee.
                    particles.play(); 
                } else {
                    console.error("ERROR: Instantiated node from prefab is MISSING a ParticleSystem2D component!");
                }
            }
        } else {
            console.log("DEBUG: No celebration particle prefab is assigned for this item.");
        }
        
        // --- Diamond Animation (Starts at the same time) ---
        this.rewardDiamond.active = true;
        // ... (rest of the tween is unchanged)
        tween(this.rewardDiamond)
            .set({ worldPosition: startPos, scale: Vec3.ONE })
            .to(1.0, { worldPosition: scoreLabelNode.getWorldPosition(), scale: Vec3.ZERO }, { easing: 'cubicIn' })
            .call(() => {
                this.rewardDiamond.active = false;
                this.node.scene.emit('ITEM_COMPLETED', this.itemId);
            })
            .start();
    }
}