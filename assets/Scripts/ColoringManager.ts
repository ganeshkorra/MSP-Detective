import { _decorator, Component, Node, find, Vec2, UITransform, Label, AudioSource, AudioClip, tween, Vec3, UIOpacity,SpriteAtlas, Sprite, Color, CCString, Tween, CCInteger, director } from 'cc';
import { DraggableItem } from './DraggableItem';
import { DropZone } from './DropZone';
import { TutorialDragController } from './TutorialDragController';
import { StickerAnimation } from './StickerAnimation';
import { GlobalTimer } from './GameTimer';
import { Analytics, analyticsEvents } from './Analytics';

const { ccclass, property } = _decorator;

@ccclass('ColoringGameManager')
export class ColoringGameManager extends Component {
    
    
    // --- Tutorial Properties ---
    @property({type: Node, tooltip: "The semi-transparent black overlay for the tutorial."})
    public tutorialSpotlightOverlay: Node = null;

    @property({type: Node, tooltip: "The 'Drag To Match' text label."})
    public dragToMatchLabel: Node = null;

    @property({ type: TutorialDragController, tooltip: "The hand controller for the drag-and-drop tutorial." })
    public tutorialController: TutorialDragController = null;

    // --- Core Gameplay Properties ---
    @property({ type: [DraggableItem], tooltip: "Drag all Draggable Item nodes here, NOT the groups." })
    public draggableItems: DraggableItem[] = [];

    // --- Panning Properties ---
    @property({ type: Node, tooltip: "The parent node containing BG, Silhouettes, and PlacedItemsContainer." })
    public pannableContainer: Node = null;

    @property({ type: Node, tooltip: "The target for the FIRST pan." }) 
    public panTarget: Node = null;
    
    @property({ type: Node, tooltip: "The target for the SECOND pan." })
    public panTarget1: Node = null;
    
    @property({ type: Node, tooltip: "The target for the THIRD pan." })
    public panTarget2: Node = null;

    // --- UI and Feedback Properties ---
    @property({ type: Node, tooltip: "The parent node of the draggable items tray." })
    public itemsTrayNode: Node = null;

    @property({ type: Node, tooltip: "The CTA screen to show on win." }) 
    public ctaButtonNode: Node = null;
    
    @property({ type: Label, tooltip: "The label on the CTA screen for the win message." })
    public endScreenTitleLabel: Label = null;

    @property({ type: CCString, tooltip: "The message to show when the player wins." })
    public winMessage: string = "Congratulations!";

    @property({ type: CCString, tooltip: "The message to show when the player loses." })
    public loseMessage: string = "Try Again!";

    @property({ type: Label, tooltip: "Optional: A label to show collection progress." }) 
    public progressLabel: Label | null = null;
    
    // --- Audio Properties ---
    @property({ type: AudioSource }) public sfxAudioSource: AudioSource | null = null;
    @property({ type: AudioSource }) public bgmAudioSource: AudioSource | null = null;
    @property({ type: AudioClip }) public successSound: AudioClip | null = null;
    @property({ type: AudioClip }) public failureSound: AudioClip | null = null;

    @property({
        type: [StickerAnimation],
        tooltip: "Drag all of the individual sticker effect nodes here (e.g., Teddy_C_Effect)."
    })
    public stickerEffects: StickerAnimation[] = [];

    @property({ type: CCString, tooltip: "The message for when the timer runs out." })
    public timeUpMessage: string = "Try Again!"; // A more direct CTA message

 @property({ 
        type: CCInteger, 
        tooltip: "End the game early after this many items. Set to 0 to require ALL items." 
    })
    public itemsToWinEarly: number = 6; // <--- DEFAULT IS 3


    // === ADD THIS PRIVATE VARIABLE ===
    private stickerAnimator: StickerAnimation | null = null;
    
    // --- Private State Variables ---
    private completedDropZoneIds: Set<string> = new Set();
    private correctlyPlacedItems: number = 0;
    private totalItemsToPlace: number = 0;
    private isGameOver: boolean = false;
    private hasInteracted: boolean = false;
    private currentPanStage: number = 0; // 0 = before 1st pan, 1 = before 2nd, 2 = after 2nd
    private idleTime: number = 0;
    private readonly IDLE_HINT_DURATION: number = 7.0; // 7 seconds
    private isIdleHintActive: boolean = false;
    private playerHasInteracted: boolean = false; // To track the very first interaction
    private challengeStartedTracked: boolean = false; // For analytics

    onLoad() {
        director.on('TIME_UP', this.onTimeUp, this);
        this.node.scene.on('ITEM_DROPPED', this.onItemDropped, this);
        this.node.scene.on('DRAG_STARTED', this.onPlayerInteraction, this);
    }

    onDestroy() {
        director.off('TIME_UP', this.onTimeUp, this);
        this.node.scene.off('ITEM_DROPPED', this.onItemDropped, this);
        this.node.scene.off('DRAG_STARTED', this.onPlayerInteraction, this);
    }

    start() {
        if (this.ctaButtonNode) this.ctaButtonNode.active = false;
        if (this.tutorialSpotlightOverlay) this.tutorialSpotlightOverlay.active = false;
        if (this.dragToMatchLabel) this.dragToMatchLabel.active = false;
        
        
        this.correctlyPlacedItems = 0;
        this.totalItemsToPlace = this.draggableItems.length;
        this.isGameOver = false;
        this.hasInteracted = false;
        this.currentPanStage = 0;
        // Idle hint initial state
        this.isIdleHintActive = false;
        this.playerHasInteracted = false;
        this.idleTime = 0;
        this.completedDropZoneIds.clear(); // Ensure it's empty at the start of a new game
        this.challengeStartedTracked = false;
        
        this.updateProgressLabel();

        // Force the UI tray to always be on top.
        if (this.itemsTrayNode) {
            this.itemsTrayNode.setSiblingIndex(999);
        }
        
        // --- Analytics: Reset tracking and send DISPLAYED event ---
        if (Analytics.instance) {
            Analytics.instance.resetTracking();
            Analytics.instance.dispatchEvent(analyticsEvents.DISPLAYED);
        }
        
        // Start the intro tutorial after a brief delay.
        this.scheduleOnce(() => {
            this.startDragTutorial();
        }, 1.0);
    }
    
    update(deltaTime: number) {
        // Do nothing if the game is already over
        if (this.isGameOver) return;
        
        // --- Keep your existing Idle Hint logic here ---
        if (this.playerHasInteracted && !this.isIdleHintActive) {
            this.idleTime += deltaTime;
            if (this.idleTime >= this.IDLE_HINT_DURATION) {
                this.tryStartIdleHint();
            }
        }
    }
    
    private onPlayerInteraction() {
        // 1. Reset the idle timer to 0 every time the player touches the screen.
        this.idleTime = 0;

        // 2. Mark that the initial interaction has happened (this starts the idle timer logic in update())
        if (!this.playerHasInteracted) {
            this.playerHasInteracted = true;
            this.hasInteracted = true;
            this.cleanupTutorialElements();
        }

        // 3. If an idle hint was active, stop it immediately.
        if (this.isIdleHintActive) {
            this.isIdleHintActive = false;
            if (this.tutorialController) {
                const tc: any = this.tutorialController;
                if (typeof tc.stopAndHide === 'function') {
                    tc.stopAndHide();
                } else if (typeof tc.stopTutorial === 'function') {
                    tc.stopTutorial();
                }
            }
            console.log("Player interacted. Stopping idle hint.");
        }
    }

 // In ColoringGameManager.ts

private tryStartIdleHint() {
    if (this.isIdleHintActive || this.isGameOver || !this.tutorialController) {
        return;
    }
    
    this.idleTime = 0;

    // === NEW AND ROBUST LOGIC ===
    // Find the very first draggable item whose target drop zone ID
    // is NOT in our list of completed zones.
    let nextItemToShow: DraggableItem | null = null;
    for (const item of this.draggableItems) {
        if (!this.completedDropZoneIds.has(item.targetDropZone.id)) {
            nextItemToShow = item;
            break; // We found the next available item.
        }
    }
    // ============================

    if (nextItemToShow) {
        this.isIdleHintActive = true;
        console.log("Player is idle. Showing DRAG hint for:", nextItemToShow.node.name);

        const startNode = nextItemToShow.node;
        const endNode = nextItemToShow.targetDropZone.node;
        
        const tc: any = this.tutorialController;
        if (startNode && endNode && startNode.isValid && endNode.isValid) {
            if (typeof tc.playDragTutorial === 'function') {
                tc.playDragTutorial(startNode, endNode);
            } else if (typeof tc.playTutorial === 'function') { 
                tc.playTutorial(startNode, endNode);
            }
        } else {
            console.warn("Could not start idle hint: start/end node invalid.");
            this.isIdleHintActive = false;
        }

    } else {
        console.log("No available items found for idle hint.");
    }
}

    private startDragTutorial() {
        if (this.hasInteracted) return;

        const startItem = this.draggableItems[0];
        const endZone = startItem?.targetDropZone;

        if (startItem && endZone) {
            this.reparentItemToOverlay(startItem.node.parent); // Reparent the "Group 1" node
            this.reparentItemToOverlay(endZone.node);
 if (this.dragToMatchLabel) {
                this.dragToMatchLabel.active = true;
                this.dragToMatchLabel.setScale(new Vec3(0, 0, 1));
                tween(this.dragToMatchLabel)
                    .to(0.6, { scale: Vec3.ONE }, { easing: 'backOut' })
                    .call(() => {
                        // Start the perpetual 'breathing' animation after popping in
                        tween(this.dragToMatchLabel).sequence(
                            tween().to(0.7, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'quadInOut' }),
                            tween().to(0.7, { scale: Vec3.ONE }, { easing: 'quadInOut' })
                        ).repeatForever().start();
                    })
                    .start();
            }
            if (this.dragToMatchLabel) {
                this.dragToMatchLabel.active = true;
                this.dragToMatchLabel.setScale(new Vec3(0, 0, 1));
                tween(this.dragToMatchLabel).to(0.6, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            }

            if (this.tutorialSpotlightOverlay) {
                this.tutorialSpotlightOverlay.active = true;
            }

            if (this.tutorialController) {
                this.tutorialController.playTutorial(startItem.node, endZone.node);
            }
        }
    }
    
    private onItemDropped(item: DraggableItem, dropLocation: Vec2) {
        if (this.isGameOver) { item.returnToOriginalPosition(); return; }
        
        const targetZone = item.targetDropZone;
        if (!targetZone) { item.returnToOriginalPosition(); return; }
        
        const zoneUITransform = targetZone.getComponent(UITransform);
        const worldBounds = zoneUITransform.getBoundingBoxToWorld();

        if (worldBounds.contains(new Vec2(dropLocation.x, dropLocation.y))) {
            this.handleCorrectDrop(item, targetZone);
        } else {
            this.handleIncorrectDrop(item);
        }
    }
 

private handleCorrectDrop(item: DraggableItem, zone: DropZone) {
        // 1. Play success sound.
        if (this.sfxAudioSource && this.successSound) {
            this.sfxAudioSource.playOneShot(this.successSound);
        }

        // 2. Hide item temporarily / handle slot UI logic
        item.disappearAndHideSlot();
        this.completedDropZoneIds.add(zone.id);

        const zoneSprite = zone.getComponent(Sprite);
        if (zoneSprite) { zoneSprite.enabled = false; }

        this.correctlyPlacedItems++;
        this.updateProgressLabel();
        
        console.log(`TRACKING: Progress ${this.correctlyPlacedItems} / ${this.itemsToWinEarly || this.totalItemsToPlace}`);
        
        // --- Analytics: Track progress percentage ---
        const progressPercent = (this.correctlyPlacedItems / (this.itemsToWinEarly || this.totalItemsToPlace)) * 100;
        if (Analytics.instance) {
            Analytics.instance.trackChallengeProgress(progressPercent);
        }

        // --- DEFINE WIN SEQUENCE ---
        const triggerWinSequence = () => {
            console.log("TRACKING: ⚡ Win Threshold Reached! Finishing placement then waiting 2s.");
            
            // Step 1: Play the effect (Peel animation)
            this.playEffectAndFinalize(item, zone, () => {
                
                // Step 2: IMPORTANT - Actually snap the item into the final picture so it looks correct!
                item.moveToDropZone(zone, false); // false = no fly animation, just snap

                // Step 3: Wait 2 seconds before showing the CTA
                this.scheduleOnce(() => {
                    this.winGame();
                }, 1.0);
            });
        };

        // --- CHECK CONDITIONS ---

        // Condition A: Early Win Limit Reached (e.g., 3 items)
        if (this.itemsToWinEarly > 0 && this.correctlyPlacedItems >= this.itemsToWinEarly) {
            triggerWinSequence();
            return;
        }

        // Condition B: All items placed (Total Completion)
        if (this.correctlyPlacedItems >= this.totalItemsToPlace) {
            triggerWinSequence();
            return;
        }

        // --- STANDARD PLAY (Game Continues) ---
        // Just play the effect, settle the item, and handle panning.
        
        // Check Panning logic
     // Updated logic to include a 3rd Pan
if (this.currentPanStage === 0 && this.correctlyPlacedItems === 2) {
    this.currentPanStage++;
    this.scheduleOnce(() => { this.panToTarget(this.panTarget); }, 0.6);
} else if (this.currentPanStage === 1 && this.correctlyPlacedItems === 3) {
    this.currentPanStage++;
    this.scheduleOnce(() => { this.panToTarget(this.panTarget1); }, 0.6);
} else if (this.currentPanStage === 2 && this.correctlyPlacedItems === 5) { // Example: Trigger at 11
    this.currentPanStage++;
    // You would need to define panTarget2 as a @property first
    this.scheduleOnce(() => { this.panToTarget(this.panTarget2); }, 0.6);
}
        this.playEffectAndFinalize(item, zone, () => {
            item.moveToDropZone(zone, false);
        });
    }
private playEffectAndFinalize(item: DraggableItem, zone: DropZone, onComplete: Function) {
        const effectPlayer = this.stickerEffects.find(effect => effect.node.name === zone.id + "_Effect");

        if (effectPlayer) {
            const zoneUIT = zone.node.getComponent(UITransform);
            const effectUIT = effectPlayer.node.getComponent(UITransform);
            if (zoneUIT && effectUIT) { effectUIT.contentSize = zoneUIT.contentSize; }

            const worldPosition = zone.node.getWorldPosition();
            const parentUIT = effectPlayer.node.parent.getComponent(UITransform);
            const localPosInParent = parentUIT.convertToNodeSpaceAR(worldPosition);
            
            effectPlayer.node.setPosition(localPosInParent);
            effectPlayer.node.active = true;
            
            effectPlayer.playAnimation(() => {
                effectPlayer.node.active = false;
                item.node.active = true;
                onComplete(); // Call the logic passed in
            });
        } else {
            // No animation, just do it
            item.node.active = true; 
            onComplete();
        }
    }
    private panToTarget(targetNode: Node) {
        if (this.pannableContainer && targetNode) {
            tween(this.pannableContainer)
                .to(1.2, { position: targetNode.position }, { easing: 'cubicInOut' })
                .start();
        } else {
            console.warn("Pannable Container or Pan Target is not set!");
        }
    }
    
    private handleIncorrectDrop(item: DraggableItem) {
        if (this.sfxAudioSource && this.failureSound) {
            this.sfxAudioSource.playOneShot(this.failureSound);
        }
        item.returnToOriginalPosition();
    }
    
    private onTimeUp() {
        console.log("ColoringGameManager (Scene 2) heard TIME_UP event!");
        // When time runs out, the player loses
        
        // --- Analytics: Time up = Challenge Failed ---
        if (Analytics.instance) {
            Analytics.instance.dispatchEvent(analyticsEvents.CHALLENGE_FAILED);
            console.log("TRACKING: ⏰ CHALLENGE_FAILED event sent (Time Up - Coloring Game)");
        }
        
        this.loseGame(this.timeUpMessage);
    }
    
    private winGame(endMessage?: string) {
    if (this.isGameOver) return;
     console.log(`TRACKING: 🏆 Final CTA Triggered! Reason: ${endMessage ? "Time Up Force" : "Natural Win"}`);
    this.isGameOver = true;
    
    // Stop BGM when CTA is triggered
    if (this.bgmAudioSource) {
        this.bgmAudioSource.stop();
    }
    
    // Stop any active idle hint when the game ends
    if (this.isIdleHintActive && this.tutorialController) {
        (this.tutorialController as any).stopTutorial();
    }
    
    // --- Analytics: Challenge Solved ---
    if (Analytics.instance) {
        Analytics.instance.dispatchEvent(analyticsEvents.CHALLENGE_SOLVED);
        console.log("TRACKING: 🏆 CHALLENGE_SOLVED event sent (Coloring Game)");
    }

    if (this.endScreenTitleLabel) {
        // If a custom message was passed (from the timer), use it.
        // Otherwise, use the default winMessage from the Inspector.
        this.endScreenTitleLabel.string = endMessage || this.winMessage;
        this.endScreenTitleLabel.node.active = true;
    }

    // The CTA button animation logic remains exactly the same.
    if (this.ctaButtonNode) {
        this.scheduleOnce(() => {
               console.log("TRACKING: 📥 'Download' Button is now Visible on Screen.");
            if (!this.ctaButtonNode) return;
            this.ctaButtonNode.active = true;
            this.ctaButtonNode.setScale(new Vec3(0, 0, 1));
            const opacity = this.ctaButtonNode.getComponent(UIOpacity) ?? this.ctaButtonNode.addComponent(UIOpacity);
            opacity.opacity = 0;
            tween(this.ctaButtonNode).to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            tween(opacity).to(0.4, { opacity: 255 }).start();
            
            // --- Analytics: Endcard shown on win ---
            if (Analytics.instance) {
                Analytics.instance.dispatchEvent(analyticsEvents.ENDCARD_SHOWN);
                console.log("TRACKING: 📺 ENDCARD_SHOWN event sent (Coloring Game - Win)");
            }
        }, 0.5);
    }
    }
    
    private loseGame(lossMessage?: string) {
        if (this.isGameOver) return;
        console.log(`TRACKING: 💀 Player Lost! Reason: ${lossMessage || "Unknown"}`);
        this.isGameOver = true;
        
        // Stop BGM when game is lost
        if (this.bgmAudioSource) {
            this.bgmAudioSource.stop();
        }
        
        // Stop any active idle hint when the game ends
        if (this.isIdleHintActive && this.tutorialController) {
            (this.tutorialController as any).stopTutorial();
        }

        if (this.endScreenTitleLabel) {
            // Show the loss message (default: "Try Again!")
            this.endScreenTitleLabel.string = lossMessage || this.loseMessage;
            this.endScreenTitleLabel.node.active = true;
        }

        // Show the CTA button with the same animation
        if (this.ctaButtonNode) {
            this.scheduleOnce(() => {
                console.log("TRACKING: 📥 'Retry' Button is now Visible on Screen (Loss State).");
                if (!this.ctaButtonNode) return;
                this.ctaButtonNode.active = true;
                this.ctaButtonNode.setScale(new Vec3(0, 0, 1));
                const opacity = this.ctaButtonNode.getComponent(UIOpacity) ?? this.ctaButtonNode.addComponent(UIOpacity);
                opacity.opacity = 0;
                tween(this.ctaButtonNode).to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
                tween(opacity).to(0.4, { opacity: 255 }).start();
                
                // --- Analytics: Endcard shown on loss ---
                if (Analytics.instance) {
                    Analytics.instance.dispatchEvent(analyticsEvents.ENDCARD_SHOWN);
                    console.log("TRACKING: 📺 ENDCARD_SHOWN event sent (Coloring Game - Loss)");
                }
            }, 0.5);
        }
    }
    
    private updateProgressLabel() {
        if (this.progressLabel) {
            this.progressLabel.string = `${this.correctlyPlacedItems} / ${this.totalItemsToPlace}`;
        }
    }
    
    private reparentItemToOverlay(item: Node) { 
        if (!this.tutorialSpotlightOverlay || !item.parent) return; 
        const overlayUIT = this.tutorialSpotlightOverlay.getComponent(UITransform); 
        const worldPos = item.parent.getComponent(UITransform)!.convertToWorldSpaceAR(item.position); 
        item.setParent(this.tutorialSpotlightOverlay); 
        item.setPosition(overlayUIT.convertToNodeSpaceAR(worldPos)); 
        item.setSiblingIndex(1); // Ensure it's drawn on top of the black overlay sprite
    }
    
    private cleanupTutorialElements() {
        if (this.tutorialController) {
            // Call stopAndHide if implemented; otherwise try common alternative methods safely.
            const tc: any = this.tutorialController;
               if (this.dragToMatchLabel?.active) {
            Tween.stopAllByTarget(this.dragToMatchLabel); // Stop the 'breathing' loop
            tween(this.dragToMatchLabel).to(0.3, { scale: Vec3.ZERO }, { easing: 'backIn' }).call(() => {
                if (this.dragToMatchLabel) { this.dragToMatchLabel.active = false; }
            }).start();
        }
            if (typeof tc.stopAndHide === 'function') {
                tc.stopAndHide();
            } else if (typeof tc.stopTutorial === 'function') {
                tc.stopTutorial();
            }
        }
        
        // This function doesn't need to reparent things back since the
        // tutorial items are just silhouettes or copies that get destroyed/hidden.
        
        if (this.tutorialSpotlightOverlay?.active) {
            const opacity = this.tutorialSpotlightOverlay.getComponent(UIOpacity) ?? this.tutorialSpotlightOverlay.addComponent(UIOpacity);
            tween(opacity).to(0.3, { opacity: 0 }).call(() => {
                if (this.tutorialSpotlightOverlay) {
                     this.tutorialSpotlightOverlay.active = false;
                     opacity.opacity = 220; // Reset for next time if needed
                }
            }).start();
        }

        if (this.dragToMatchLabel?.active) {
            tween(this.dragToMatchLabel).to(0.3, { scale: Vec3.ZERO }, { easing: 'backIn' }).call(() => {
                if (this.dragToMatchLabel) {
                    this.dragToMatchLabel.active = false;
                }
            }).start();
        }
    }
}