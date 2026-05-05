// FILE: /assets/Scripts/TutorialController.ts (Corrected and Safer)

import { _decorator, Component, Node, tween, v3, Vec3, Tween, SpriteFrame, Sprite, UITransform, input, Input, EventTouch, EventMouse, systemEvent, SystemEvent } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TutorialDragController')
export class TutorialDragController extends Component {
    @property({ type: Node, tooltip: "The hand sprite node that will be animated." })
    public handNode: Node | null = null;

    @property({ type: SpriteFrame, tooltip: "The sprite for the idle/pointing hand." })
    public idleHandSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: "The sprite for the hand when it is 'clicked down'." })
    public clickHandSprite: SpriteFrame | null = null;

    private handTween: Tween<Node> | null = null;
    private inputListenersAdded: boolean = false;
    private globalInputListenersAdded: boolean = false;
    private isIdleHintActive: boolean = false;
    private lastInputTime: number = 0;
    private inactivityTimeout: number = 5; // seconds before showing idle hint

    public playTutorial(startNode: Node, endNode: Node): void {
        if (!this.handNode || !this.idleHandSprite || !this.clickHandSprite) return;
        
        // --- ADDED SAFETY CHECK ---
        // Ensure nodes are valid when starting the tutorial
        if (!startNode || !endNode || !startNode.isValid || !endNode.isValid) return;

        this.handNode.active = true;
        this.addInputListeners();
        this.runAnimationLoop(startNode, endNode);
    }

    public stopTutorial(): void {
        if (this.handTween) {
            this.handTween.stop();
            this.handTween = null;
        }
        if (this.handNode) {
            this.handNode.active = false;
        }
        this.removeInputListeners();
        // If this stop was triggered by user input, clear idle-hint flag
        this.isIdleHintActive = false;
    }

    // Editor-assignable nodes to use for automatic idle hint
    @property({ type: Node, tooltip: 'Optional start node for automatic idle hint' })
    public idleStartNode: Node | null = null;

    @property({ type: Node, tooltip: 'Optional end node for automatic idle hint' })
    public idleEndNode: Node | null = null;

    protected onEnable(): void {
        this.startGlobalInputMonitoring();
    }

    protected onDisable(): void {
        this.stopGlobalInputMonitoring();
        this.removeInputListeners();
        if (this.handTween) {
            this.handTween.stop();
            this.handTween = null;
        }
    }

    private startGlobalInputMonitoring(): void {
        if (this.globalInputListenersAdded) return;
        this.globalInputListenersAdded = true;
        this.lastInputTime = Date.now() / 1000;
        systemEvent.on(SystemEvent.EventType.TOUCH_START, this.onUserInputGlobal, this);
        systemEvent.on(SystemEvent.EventType.MOUSE_DOWN, this.onUserInputGlobal, this);
        this.schedule(this.inactivityCheck, 1);
    }

    private stopGlobalInputMonitoring(): void {
        if (!this.globalInputListenersAdded) return;
        this.globalInputListenersAdded = false;
        systemEvent.off(SystemEvent.EventType.TOUCH_START, this.onUserInputGlobal, this);
        systemEvent.off(SystemEvent.EventType.MOUSE_DOWN, this.onUserInputGlobal, this);
        this.unschedule(this.inactivityCheck);
    }

    private onUserInputGlobal(event: EventTouch | EventMouse | any): void {
        this.lastInputTime = Date.now() / 1000;
        // If an idle hint is showing, hide it immediately on player input.
        if (this.isIdleHintActive) {
            this.stopTutorial();
            this.isIdleHintActive = false;
        }
    }

    private inactivityCheck(): void {
        // Only attempt idle hint if idle nodes configured and no tutorial currently playing
        if (!this.idleStartNode || !this.idleEndNode) return;
        if (!this.handNode) return;
        // If hand is already visible and animating from an active tutorial, don't override
        if (this.handNode.active && this.inputListenersAdded && !this.isIdleHintActive) return;

        const now = Date.now() / 1000;
        if (now - this.lastInputTime >= this.inactivityTimeout) {
            // Show idle hint
            if (!this.handNode.active) {
                this.isIdleHintActive = true;
                this.playTutorial(this.idleStartNode!, this.idleEndNode!);
            }
        }
    }

    private addInputListeners(): void {
        if (this.inputListenersAdded) return;
        this.inputListenersAdded = true;
        systemEvent.on(SystemEvent.EventType.TOUCH_START, this.onInputStart, this);
        systemEvent.on(SystemEvent.EventType.MOUSE_DOWN, this.onInputStart, this);
    }

    private removeInputListeners(): void {
        if (!this.inputListenersAdded) return;
        this.inputListenersAdded = false;
        systemEvent.off(SystemEvent.EventType.TOUCH_START, this.onInputStart, this);
        systemEvent.off(SystemEvent.EventType.MOUSE_DOWN, this.onInputStart, this);
    }

    private onInputStart(event: EventTouch | EventMouse | any): void {
        // When the player touches/clicks anywhere, immediately stop and hide the hand tutorial.
        this.stopTutorial();
    }

    private runAnimationLoop(startNode: Node, endNode: Node): void {
        const handSprite = this.handNode?.getComponent(Sprite);
        if (!handSprite) return;

        // --- THE MOST IMPORTANT FIX IS HERE ---
        // Before starting a new loop, check if the target nodes were destroyed.
        if (!startNode.isValid || !endNode.isValid) {
            this.stopTutorial();
            return; // Exit gracefully
        }
        
        const startPosition = this.getUIPosition(startNode);
        const endPosition = this.getUIPosition(endNode);

        // If a node was destroyed while getting position, it will return null
        if (!startPosition || !endPosition) {
            this.stopTutorial();
            return;
        }

        handSprite.spriteFrame = this.idleHandSprite;
        this.handNode!.setPosition(startPosition);

        this.handTween = tween(this.handNode!)
            .delay(0.5)
            .call(() => {
                handSprite.spriteFrame = this.clickHandSprite!;
            })
            .delay(0.15)
            .to(1.5, { position: endPosition }, { easing: 'sineInOut' })
            .call(() => {
                handSprite.spriteFrame = this.idleHandSprite!;
            })
            .delay(0.5)
            .call(() => {
                // By the time this recursive call happens, the nodes might be gone.
                // We've added a check at the top of the function to handle this.
                this.runAnimationLoop(startNode, endNode)
            }) 
            .start();
    }
    
    private getUIPosition(targetNode: Node): Vec3 | null {
        const referenceNode = this.handNode?.parent;
        
        // --- ADDED SAFETY CHECK ---
        if (!referenceNode || !targetNode.isValid) return null;

        const refUIT = referenceNode.getComponent(UITransform);
        const targetUIT = targetNode.getComponent(UITransform);
        if (!refUIT || !targetUIT) return null;

        const worldPos = targetUIT.convertToWorldSpaceAR(v3(0, 0, 0));
        return refUIT.convertToNodeSpaceAR(worldPos);
    }
}