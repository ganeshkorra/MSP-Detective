// FILE: /assets/Scripts/ItemController.ts (Final Version with CONVERGE & POP Animation)

import { _decorator, Component, Node, input, Input, EventTouch, Vec3, UITransform, RigidBody2D, ERigidBody2DType, tween, BoxCollider2D, Sprite, Color, Size, Tween } from 'cc';
import { GameManager } from './GameManager';
import { GlobalTimer } from './GameTimer'; 

const { ccclass } = _decorator;

@ccclass('ItemController')
export class ItemController extends Component {
    public itemId: number = -1;
    public itemLevel: number = 0;
    public gameManager: GameManager = null;
    private rigidBody: RigidBody2D = null;
    private collider: BoxCollider2D = null;
    private isDragging: boolean = false;
    private startPosition: Vec3 = new Vec3();
    private ghostNode: Node = null;
    private isMerging: boolean = false;

    public setup(id: number, level: number, manager: GameManager) {
        this.itemId = id;
        this.itemLevel = level;
        this.gameManager = manager;
    }

    onLoad() {
        this.rigidBody = this.getComponent(RigidBody2D);
        this.collider = this.getComponent(BoxCollider2D);
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this.onDrop, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.onDrop, this);
    }

 
    onTouchStart(event: EventTouch) {
        if (this.gameManager && this.gameManager.isGameOver) return;
        
        // --- ADD THIS BLOCK HERE ---
        // Ensure timer starts even if GameManager input listener failed
        if (!GlobalTimer.isRunning) {
            console.log("TRACKING: Player touched ItemController. Forcing Timer Start.");
            GlobalTimer.startTimer();
        }
        // ---------------------------

        if (this.isMerging) return; 

        if (this.gameManager) {
             this.gameManager.playerDidStartDrag();
        }
        
        this.isDragging = true;
        this.startPosition.set(this.node.position);

        if (this.rigidBody) this.rigidBody.enabled = false;
        if (this.collider) this.collider.enabled = false;
        
        const originalSprite = this.getComponent(Sprite);
        originalSprite.color = new Color(255, 255, 255, 200);

        this.ghostNode = new Node('BlockerGhost');
        const ghostSprite = this.ghostNode.addComponent(Sprite);
        ghostSprite.spriteFrame = originalSprite.spriteFrame;
        ghostSprite.color = new Color(255, 255, 255, 80);
        const ghostRB = this.ghostNode.addComponent(RigidBody2D);
        ghostRB.type = ERigidBody2DType.Static;
        const ghostCollider = this.ghostNode.addComponent(BoxCollider2D);
        if (this.collider) {
            ghostCollider.size = this.collider.size;
            ghostCollider.offset = this.collider.offset;
        }
        ghostCollider.apply();
        this.node.parent.addChild(this.ghostNode);
        this.ghostNode.setPosition(this.startPosition);
        
        this.node.setSiblingIndex(999);
    }

    onTouchMove(event: EventTouch) {
        if (!this.isDragging) return;
        const delta = event.getUIDelta();
        this.node.position = this.node.position.add3f(delta.x, delta.y, 0);
    }
    
    onDrop(event: EventTouch) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        if (this.ghostNode && this.ghostNode.isValid) {
            this.ghostNode.destroy();
            this.ghostNode = null;
        }
        this.getComponent(Sprite).color = Color.WHITE;

        if (!this.node || !this.node.isValid) return;

        let didMerge = false;
        const allItems = this.node.parent.children;

        for (const otherNode of allItems) {
            if (!otherNode.isValid || otherNode === this.node) continue;
            
            const otherController = otherNode.getComponent(ItemController);
            if (!otherController) continue;

            if (otherController.itemId === this.itemId && otherController.itemLevel === this.itemLevel) {
                const myBox = this.getComponent(UITransform).getBoundingBoxToWorld();
                const otherBox = otherNode.getComponent(UITransform).getBoundingBoxToWorld();

                if (myBox.intersects(otherBox)) {
                    if (this.isMerging || otherController.isMerging) {
                        continue;
                    }
                    this.isMerging = true;
                    otherController.isMerging = true;
                    didMerge = true;

                    const otherRigidBody = otherNode.getComponent(RigidBody2D);
                    if (this.rigidBody) this.rigidBody.enabled = false;
                    if (otherRigidBody) otherRigidBody.enabled = false;

                    if (this.collider) this.collider.enabled = false;
                    if (otherController.collider) otherController.collider.enabled = false;
                    
                    const mergePosition = this.node.position.clone().add(otherNode.position).multiplyScalar(0.5);

                    tween(this.node)
                        .to(0.15, { position: mergePosition, scale: new Vec3(1.2, 1.2, 1) }, { easing: 'sineOut' })
                        .to(0.1, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
                        .call(() => {
                            if (this.node.isValid && otherNode.isValid) {
                                this.gameManager.handleMerge(this.itemId, this.itemLevel, mergePosition);
                                
                                Tween.stopAllByTarget(this.node);
                                Tween.stopAllByTarget(otherNode);

                                this.node.destroy();
                                otherNode.destroy();
                            }
                        })
                        .start();

                    tween(otherNode)
                        .to(0.15, { position: mergePosition, scale: new Vec3(1.2, 1.2, 1) }, { easing: 'sineOut' })
                        .to(0.1, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
                        .start();

                    break; 
                }
            }
        }

        if (!didMerge && this.node && this.node.isValid) {
            tween(this.node).to(0.2, { position: this.startPosition }, { easing: 'cubicOut' }).call(() => {
                if (this.node && this.node.isValid) {
                    if (this.collider) this.collider.enabled = true;
                    if (this.rigidBody) {
                        this.rigidBody.enabled = true;
                        this.rigidBody.linearVelocity.set(0, 0);
                    }
                }
            }).start();
        }
    }
}