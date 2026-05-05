// DraggableItem.ts
import { _decorator, Component, Node, EventTouch, Vec3, UIOpacity, tween, UITransform, ScrollView, CCString, Layout, find } from 'cc';
import { DropZone } from './DropZone';
import { AudioManager } from './AudioManager';

const { ccclass, property } = _decorator;

@ccclass('DraggableItem')
export class DraggableItem extends Component {
    @property(CCString) public dropId: string = "";
    @property({ type: DropZone }) 
public targetDropZone: DropZone = null;
    @property public dragScaleMultiplier: number = 1.1;
  @property({ 
        type: Number, 
        tooltip: "The intensity of the 'pop' animation on a successful drop. 1.1 = 10% pop." 
    })
    public popScaleMultiplier: number = 1.15;
    private initialPosition: Vec3 = new Vec3();
    private initialParent: Node = null;
    private initialOpacity: number = 255;
    private initialScale: Vec3 = new Vec3();
    private scrollView: ScrollView = null;


    onLoad() {
        this.initialScale.set(this.node.scale);
        if (!this.targetDropZone) {
            console.warn(`DraggableItem '${this.dropId}' missing targetDropZone!`);
        }
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy() {
        this.removeListeners();
    }
    
    private onTouchStart(event: EventTouch) {
        AudioManager.instance.playTapSound();
        this.node.scene.emit('GAME_START_TOUCH');
        this.node.scene.emit('DRAG_STARTED');
        this.findAndDisableScrollView();
        this.storeInitialState();
        this.targetDropZone.startPulsingHint();
        this.reparentToCanvas();
        this.node.setWorldPosition(event.getUILocation().x, event.getUILocation().y, 0);
        this.tweenToDragScale();
    }

    private onTouchMove(event: EventTouch) {
        this.node.setWorldPosition(event.getUILocation().x, event.getUILocation().y, 0);
    }

    private onTouchEnd(event: EventTouch) {
        this.targetDropZone.stopPulsingHint();
        if (this.scrollView) {
            this.scrollView.enabled = true;
        }
        this.node.scene.emit('ITEM_DROPPED', this, event.getUILocation());
    }
    
    // public disappearAndDeactivateSlot() {
    //     tween(this.node).stop();
    //     this.removeListeners();
        
    //     if (this.initialParent) {
    //         this.initialParent.active = false;
    //     }
        
    //     this.node.destroy();
    // }

    public returnToOriginalPosition() {
        const targetWorldPos = this.initialParent.getComponent(UITransform).convertToWorldSpaceAR(this.initialPosition);
        tween(this.node)
            .to(0.3, { worldPosition: targetWorldPos, scale: this.initialScale }, { easing: 'cubicOut' })
            .call(() => {
                this.node.setParent(this.initialParent);
                this.node.setPosition(this.initialPosition);
                const opacity = this.getComponent(UIOpacity);
                if (opacity) { opacity.opacity = this.initialOpacity; }
            }).start();
    }

    private storeInitialState() { 
        this.initialPosition.set(this.node.position);
        this.initialParent = this.node.parent;
        const opacity = this.getComponent(UIOpacity);
        if (opacity) { this.initialOpacity = opacity.opacity; opacity.opacity = 180; }
    }

    private findAndDisableScrollView() {
        this.scrollView = null; let parent = this.node.parent;
        while (parent) {
            const sc = parent.getComponent(ScrollView);
            if (sc) { this.scrollView = sc; this.scrollView.enabled = false; break; }
            parent = parent.parent;
        }
    }

    private reparentToCanvas() {
        const canvasNode = find('Canvas');
        if (canvasNode) { this.node.setParent(canvasNode); this.node.setSiblingIndex(9999); } 
        else { this.node.setParent(this.node.scene); }
    }

    private tweenToDragScale() {
        if (!this.targetDropZone) return;
        const itemUIT = this.getComponent(UITransform);
        const zoneUIT = this.targetDropZone.getComponent(UITransform);
        const targetScaleX = (zoneUIT.width / itemUIT.width) * this.initialScale.x;
        const targetScaleY = (zoneUIT.height / itemUIT.height) * this.initialScale.y;
        const finalScale = new Vec3(targetScaleX, targetScaleY, 1);
        finalScale.multiplyScalar(this.dragScaleMultiplier);
        tween(this.node).to(0.2, { scale: finalScale },).start();
    }
    
    private removeListeners() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
  // In DraggableItem.ts

public moveToDropZone(targetZone: DropZone, animate: boolean = true) {
    this.removeListeners();

    const finalScale = this.calculateFinalScale(targetZone);
    const targetWorldPos = targetZone.node.getWorldPosition();
    const placedItemsContainer = find('Canvas/PannableContainer/PlacedItemsContainer');

    if (!placedItemsContainer) {
        console.error("Could not find 'PlacedItemsContainer'!");
        return;
    }

    const finalizePlacement = () => {
        const containerUITransform = placedItemsContainer.getComponent(UITransform);
        const localPosInContainer = containerUITransform.convertToNodeSpaceAR(targetWorldPos);
        
        this.node.setParent(placedItemsContainer);
        this.node.setPosition(localPosInContainer);
        this.node.setScale(finalScale);
        
        // --- FIX #1 HERE ---
        // OLD: this.node.setAngle(0);
        this.node.setRotationFromEuler(0, 0, 0); // Correct way to set angle to zero
        
        this.node.setSiblingIndex(targetZone.depth);
    };

    if (animate) {
        // --- FIX #2 HERE ---
        // OLD: this.node.setAngle(-5);
        this.node.setRotationFromEuler(0, 0, -5); // Correct way to set initial angle

        tween(this.node)
            .to(0.25, { worldPosition: targetWorldPos }, { easing: 'cubicOut' })
            .parallel(
                // We also need to fix the angle animation to use the 'eulerZ' property
                tween().to(0.15, { scale: finalScale.clone().multiplyScalar(1.05) }, { easing: 'cubicOut' }),
                tween().to(0.2, { eulerAngles: new Vec3(0, 0, 5) }, { easing: 'sineOut' }) // Flops to the other side
            )
            .parallel(
                tween().to(0.15, { scale: finalScale }, { easing: 'backOut' }),
                tween().to(0.2, { eulerAngles: new Vec3(0, 0, 0) }, { easing: 'backOut' }) // Settles flat
            )
            .call(finalizePlacement)
            .start();
    } else {
        this.node.setWorldPosition(targetWorldPos);
        finalizePlacement();
    }
}

       private calculateFinalScale(targetZone: DropZone): Vec3 {
        const itemWorldBox = this.getComponent(UITransform).getBoundingBoxToWorld();
        const zoneWorldBox = targetZone.getComponent(UITransform).getBoundingBoxToWorld();
        if (itemWorldBox.width === 0 || itemWorldBox.height === 0) { return Vec3.ONE; }
        const scaleFactorX = zoneWorldBox.width / itemWorldBox.width;
        const scaleFactorY = zoneWorldBox.height / itemWorldBox.height;
        return new Vec3(this.node.scale.x * scaleFactorX, this.node.scale.y * scaleFactorY, 1);
    }
    
     public disappearAndHideSlot() {
        this.removeListeners(); // Stop it from being draggable
        
        // Hide the colored piece itself
        this.node.active = false; 

        // Hide the "Group" node in the tray to trigger the conveyor belt effect
        if (this.initialParent) {
            const layoutParent = this.initialParent.parent;
            this.initialParent.active = false;
            
            if (layoutParent) {
                const layout = layoutParent.getComponent(Layout);
                if (layout) {
                    layout.updateLayout();
                }
            }
        }
    }

}


