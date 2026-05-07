import { _decorator, Component, Node, Label, Prefab, instantiate, Vec3, randomRange, Sprite, RigidBody2D, BoxCollider2D, Size, UITransform, CCInteger, CCString, tween, AudioSource, AudioClip, UIOpacity, Tween, Button, director, input, Input, Color } from 'cc';
import { ItemData } from './ItemData';
import { ItemController } from './ItemController';
import { CollectionTrackerUI } from './CollectionTrackerUI';
import { TutorialController } from './TutorialController';
import { GlobalTimer } from './GameTimer';
import { FrameAnimator } from './FrameAnimator';

import { Analytics, analyticsEvents } from './Analytics';

const { ccclass, property } = _decorator;

@ccclass('CollectionGoal')
export class CollectionGoal {
    @property({ type: [CCInteger], tooltip: "A list of item IDs that all count towards this goal." })
    public itemIds: number[] = [];
    @property({ type: CCInteger, tooltip: "How many TOTAL items from the list are required." })
    public requiredAmount: number = 10;
    @property({ type: CollectionTrackerUI, tooltip: "Drag the corresponding UI Tracker node here." })
    public trackerUI: CollectionTrackerUI = null;
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property({ type: [ItemData], tooltip: "Define all your item types and their sprites here." })
    public itemDefinitions: ItemData[] = [];
    @property({ type: [CollectionGoal], tooltip: "Define all collection goals here."})
    public collectionGoals: CollectionGoal[] = [];
    @property({type: Node, tooltip: "The 'Drag To Match' / 'One Last Merge' text node."})
    public dragToMatchText: Node | null = null;
    @property({ type: Prefab, tooltip: "The item prefab." })
    public itemBasePrefab: Prefab = null;
    @property({ type: Node, tooltip: "The parent node for items." })
    public itemContainer: Node = null;
    @property({ type: Node, tooltip: "The main UI Canvas node." })
    public uiCanvas: Node = null;s
    @property({ type: Prefab, tooltip: "The particle effect prefab to spawn on merge." })
    public mergeEffectPrefab: Prefab = null;
    @property({type: Label, tooltip: "Optional: The UI Label to display a timer."})
    public timerLabel: Label = null;
    @property({ type: [CCInteger], tooltip: "A fixed list of item IDs to spawn when the game begins." })
    public initialSpawnItemIds: number[] = [];
    @property({ type: TutorialController, tooltip: "The tutorial controller." })
    public tutorialController: TutorialController = null;
    @property({type: Node, tooltip: "The parent node for the end screen UI / CTA Canvas."})
    public endScreenNode: Node = null;
    @property({type: Label, tooltip: "The end screen that will show win/lose text."})
    public endScreenTitleLabel: Label = null;
    @property({type: CCString, tooltip: "The message to show when the player loses."})
    public loseMessage: string = "Try Again!";
    @property({ type: CCInteger, tooltip: "The Item ID to feature in the tutorials." })
    public tutorialItemId: number = 401;
    @property({type: Node, tooltip: "The semi-transparent black overlay for tutorials."})
    public tutorialSpotlightOverlay: Node = null;
    @property({type: Node, tooltip: "The glow effect for the first tutorial item."})
    public spotlightGlow1: Node = null;
    @property({type: Node, tooltip: "The glow effect for the second tutorial item."})
    public spotlightGlow2: Node = null;
    @property({ type: AudioSource, tooltip: "The main audio source component to play sound effects." })
    public sfxAudioSource: AudioSource = null;
    @property({ type: AudioSource, tooltip: "The audio source component that plays the background music (BGM)." })
    public bgmAudioSource: AudioSource | null = null;
    @property({ type: Node, tooltip: "The top-left marker for the item spawn area." })
    public spawnRangeLeftMarker: Node = null;
    @property({ type: Node, tooltip: "The top-right marker for the item spawn area." })
    public spawnRangeRightMarker: Node = null;
    @property({ type: CCString, tooltip: "The name of the scene to load when the player wins." })
    public winSceneName: string = "NextScene2";
    @property({type: Node, tooltip: "The UI button that the player clicks to spawn a new item."})
    public spawnButtonItem: Node = null;
    @property({type: Label, tooltip: "The 'CLICK HERE!' text label for the spawn button hint."})
    public spawnHintLabel: Label = null;
    @property({ type: FrameAnimator, tooltip: "The frame animator to play when player first touches the game." })
    public firstTouchAnimator: FrameAnimator | null = null;
    @property({ type: Node, tooltip: "The frame animator node that shows before player drags. Will be destroyed on first drag." })
    public preDragAnimatorNode: Node | null = null;

    @property({ type: CollectionTrackerUI, tooltip: "If this specific UI Tracker is completed, the game wins immediately." })
    public sceneTriggerTracker: CollectionTrackerUI | null = null;

    public isGameOver: boolean = false;
    private readonly IDLE_TUTORIAL_THRESHOLD = 10.0;
    private readonly SPOTLIGHT_DARK_OPACITY = 200;
    private readonly TUTORIAL_DARK_OPACITY = 220;
    private readonly NUM_SPAWN_LANES: number = 5;
    
    private idleTime: number = 0;
    private goalProgress: number[] = [];
    private collectedItemsPerGoal: Set<number>[] = [];
    private challengeStartedTracked: boolean = false;
    private totalGoalAmount: number = 0;
    
    private isGameStarted: boolean = false;
    private isTutorialActive: boolean = false;
    private isInitialTutorialActive: boolean = false;
    private originalStartNodeParent: Node = null;
    private isIdleSpotlightActive: boolean = false;
    private idleSpotlightItems: Node[] = [];
    private spawnLaneQueue: number[] = [];
    
    private hasMadeFirstMerge: boolean = false;
    private isSpawnHintActive: boolean = false;
    private spawnButtonClickCount: number = 0;
    private hasPlayedFirstTouchAnimation: boolean = false;
    
    onLoad() {
        director.on('TIME_UP', this.onTimeUp, this);
    }
    
   onDestroy() {
        // 1. Remove the Time Up listener
        director.off('TIME_UP', this.onTimeUp, this);
        
        // 2. CRITICAL FIX: Remove the Input listeners immediately when this object is destroyed.
        // This stops the "Cannot read properties of null (reading 'cameraPriority')" error.
        input.off(Input.EventType.TOUCH_START, this.handleFirstInput, this);
        input.off(Input.EventType.MOUSE_DOWN, this.handleFirstInput, this);
    }
    
    
   start() {
        if (this.endScreenNode) this.endScreenNode.active = false;
        if (this.tutorialSpotlightOverlay) this.tutorialSpotlightOverlay.active = false;
        if (this.spawnHintLabel) this.spawnHintLabel.node.active = false;
        if (this.preDragAnimatorNode) this.preDragAnimatorNode.active = true;
        
        if (this.dragToMatchText) {
            this.dragToMatchText.active = true;
            this.dragToMatchText.getComponent(Label)!.string = "Drag To Match";
            this.dragToMatchText.setScale(new Vec3(0, 0, 1));
            tween(this.dragToMatchText).delay(0.5).to(0.6, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .call(() => { 
                    if (this.dragToMatchText?.isValid) {
                        tween(this.dragToMatchText).sequence(
                            tween().to(0.7, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'quadInOut' }),
                            tween().to(0.7, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'quadInOut' })
                        ).repeatForever().start();
                    }
                }).start();
        }
        
        this.goalProgress = [];
        this.collectedItemsPerGoal = [];
        this.isGameOver = false; 
        this.isGameStarted = false; 
        this.isTutorialActive = false;
        this.isInitialTutorialActive = true;
        this.isIdleSpotlightActive = false; 
        this.idleTime = 0;

        if (this.timerLabel) this.timerLabel.node.active = false;

        this.collectionGoals.forEach(goal => {
            if (goal.trackerUI) {
                goal.trackerUI.node.active = true;
                goal.trackerUI.getComponent(UIOpacity)!.opacity = 255;
                goal.trackerUI.node.setScale(new Vec3(1, 1, 1));
                goal.trackerUI.setStateActive(false);
                goal.trackerUI.updateProgress(0, goal.requiredAmount);
            }
            this.goalProgress.push(0);
            this.collectedItemsPerGoal.push(new Set<number>());
            this.totalGoalAmount += goal.requiredAmount;
        });
        
        // --- Analytics: Reset tracking and send DISPLAYED event ---
        if (Analytics.instance) {
            Analytics.instance.resetTracking();
            Analytics.instance.dispatchEvent(analyticsEvents.DISPLAYED);
        }
        
        this.refillAndShuffleSpawnLanes();
        this.spawnInitialItems();
        this.hasMadeFirstMerge = false;
        this.spawnButtonClickCount = 0;

        this.scheduleOnce(() => this.runInitialTutorialStep(), 1.0);
    
        this.collectionGoals.forEach(goal => {
            if (goal.trackerUI) {
                const button = goal.trackerUI.getComponent(Button);
                if (button) {
                    button.node.on('click', this.requestNewItemFromUI, this);
                }
            }
        });

        // --- NEW SAFER TIMER TRIGGER ---
        // We use 'input' instead of 'this.node.scene' to avoid the cameraPriority crash
        input.on(Input.EventType.TOUCH_START, this.handleFirstInput, this);
        input.on(Input.EventType.MOUSE_DOWN, this.handleFirstInput, this);
    }
 private handleFirstInput() {
        console.log("TRACKING: First Input Detected via Input System.");
        
        // Start the timer on first interaction
        GlobalTimer.startTimer();
        
        // Play first touch animation if available
        if (this.firstTouchAnimator && !this.hasPlayedFirstTouchAnimation) {
            this.hasPlayedFirstTouchAnimation = true;
            this.firstTouchAnimator.play();
        }
        input.off(Input.EventType.MOUSE_DOWN, this.handleFirstInput, this);
    }
    
    update(deltaTime: number) {
        if (this.isGameOver) return;
        
        if (!this.isInitialTutorialActive && !this.isTutorialActive && !this.isIdleSpotlightActive) {
            this.idleTime += deltaTime;
            if (this.idleTime >= this.IDLE_TUTORIAL_THRESHOLD) this.tryStartHandTutorial();
        }
    }

    public playerDidStartDrag() {
        // Destroy the pre-drag animator node when player starts dragging
        if (this.preDragAnimatorNode && this.preDragAnimatorNode.isValid) {
            this.preDragAnimatorNode.destroy();
            this.preDragAnimatorNode = null;
        }
        
        if(this.dragToMatchText?.active) {
            Tween.stopAllByTarget(this.dragToMatchText); 
            const opacityComp = this.dragToMatchText.getComponent(UIOpacity) ?? this.dragToMatchText.addComponent(UIOpacity);
            tween(opacityComp).to(0.3, { opacity: 0 }, { easing: 'quadOut' })
                .call(() => { 
                    if (this.dragToMatchText) this.dragToMatchText.active = false; 
                }).start();
        }
        if (this.isIdleSpotlightActive) this.cleanupIdleSpotlight();
        if (this.isTutorialActive) { this.isTutorialActive = false; if (this.tutorialController) this.tutorialController.stopTutorial(); }
        this.idleTime = 0;
        
        if (!this.isGameStarted && !this.isGameOver) {
            this.isGameStarted = true;
            if (this.bgmAudioSource) this.bgmAudioSource.play();
            
            // --- Analytics: First interaction = Challenge Started ---
            if (!this.challengeStartedTracked && Analytics.instance) {
                this.challengeStartedTracked = true;
                Analytics.instance.dispatchEvent(analyticsEvents.CHALLENGE_STARTED);
                console.log("TRACKING: 🎮 CHALLENGE_STARTED event sent (Merge Game)");
            }
        }
    }
    
    public handleMerge(itemId: number, mergedLevel: number, position: Vec3) {
        const itemData = this.itemDefinitions.find(data => data.itemId === itemId);
        if (this.sfxAudioSource && itemData?.mergeSound) this.sfxAudioSource.playOneShot(itemData.mergeSound);
        if (this.mergeEffectPrefab) { 
            const particleNode = instantiate(this.mergeEffectPrefab); 
            this.itemContainer.addChild(particleNode); 
            particleNode.setPosition(position); 
            particleNode.setSiblingIndex(9999); 
        }
        
        const wasInitialTutorial = this.isInitialTutorialActive;
        const wasIdleHint = this.isIdleSpotlightActive;
        const nextLevel = mergedLevel + 1;
        let newItem: Node | null = null;

        if (nextLevel >= 2) {
            this.animateItemToCollectionUI(itemId, position);
        } else {
            newItem = this.createItem(itemId, nextLevel, position);
        }
        
        if (wasInitialTutorial) this.cleanupInitialTutorial(newItem);
        else if (wasIdleHint) this.cleanupIdleSpotlight();

        if (!this.hasMadeFirstMerge) {
            this.hasMadeFirstMerge = true;
            this.scheduleOnce(() => this.startSpawnHint(), 0.5);
        } else {
            this.scheduleOnce(() => this.checkAndShowStuckHint(), 0.5);
        }
        
        // --- Analytics: Track progress based on total collection ---
        const totalCollected = this.goalProgress.reduce((a, b) => a + b, 0);
        const progressPercent = (totalCollected / this.totalGoalAmount) * 100;
        if (Analytics.instance) {
            Analytics.instance.trackChallengeProgress(progressPercent);
        }
        
        // --- Spawn new item on successful merge ---
        this.scheduleOnce(() => this.spawnNextNeededItem(), 0.3);
    }

    private hasAvailableMerges(): boolean {
        const itemCounts = new Map<number, number>();
        for (const itemNode of this.itemContainer.children) {
            const controller = itemNode.getComponent(ItemController);
            if (controller) {
                const count = itemCounts.get(controller.itemId) || 0;
                itemCounts.set(controller.itemId, count + 1);
            }
        }
        for (const count of itemCounts.values()) {
            if (count >= 3) return true;
        }
        return false;
    }
    
    private checkAndShowStuckHint() {
        if (this.isGameOver || this.isSpawnHintActive || this.isTutorialActive) return;
        if (!this.hasAvailableMerges()) {
            this.startSpawnHint();
        }
    }

    // Handle the first global input (touch or mouse) to start the GlobalTimer safely
    private handleFirstTouch() {
        try {
            GlobalTimer.startTimer();
            // remove listeners once timer is started
            input.off(Input.EventType.TOUCH_START, this.handleFirstTouch, this);
            input.off(Input.EventType.MOUSE_DOWN, this.handleFirstTouch, this);
            console.log("TRACKING: First touch detected. Timer Started. Listener removed.");
        } catch (e) {
            console.warn("handleFirstTouch: failed to start GlobalTimer", e);
        }
    }

    private startSpawnHint() {
        if (this.isGameOver) return;
        const HINT_LIMIT = 3;
        if (this.spawnButtonClickCount >= HINT_LIMIT) return;
        if (this.isSpawnHintActive) return;
        this.isSpawnHintActive = true;

        if (this.spawnButtonItem) {
            tween(this.spawnButtonItem).to(0.5, { scale: new Vec3(1.1, 1.1, 1) }).to(0.5, { scale: Vec3.ONE }).union().repeatForever().start();
        }

        if (this.spawnHintLabel) {
            const labelNode = this.spawnHintLabel.node;
            labelNode.active = true;
            labelNode.setScale(Vec3.ZERO);
            tween(labelNode).to(0.4, { scale: Vec3.ONE }, { easing: 'backOut' })
                .call(() => {
                    tween(labelNode).sequence(tween().to(0.6, { scale: new Vec3(1.05, 1.05, 1) }), tween().to(0.6, { scale: Vec3.ONE })).repeatForever().start();
                }).start();
        }

        // if (this.tutorialController && this.spawnButtonItem) {
        //     const tc: any = this.tutorialController;
        //     if (typeof tc.playClickTutorial === 'function') tc.playClickTutorial(this.spawnButtonItem);
        //     else if (typeof tc.playTutorial === 'function') tc.playTutorial(this.spawnButtonItem);
        // }
    }
    
    private cleanupSpawnHint() {
        if (!this.isSpawnHintActive) return;
        this.isSpawnHintActive = false;
        if (this.spawnButtonItem) { Tween.stopAllByTarget(this.spawnButtonItem); this.spawnButtonItem.setScale(Vec3.ONE); }
        if (this.spawnHintLabel) { Tween.stopAllByTarget(this.spawnHintLabel.node); this.spawnHintLabel.node.active = false; }
        if (this.tutorialController) this.tutorialController.stopTutorial();
    }
    
   private animateItemToCollectionUI(itemId: number, startPosition: Vec3) {
        const itemData = this.itemDefinitions.find(data => data.itemId === itemId);
        const goalIndex = this.collectionGoals.findIndex(g => g.itemIds.indexOf(itemId) !== -1);
        
        if (goalIndex === -1) return;

        // 1. WE DECLARE 'goal' FIRST (This fixes your error)
        const goal = this.collectionGoals[goalIndex];

        if (!itemData || !goal.trackerUI || !this.uiCanvas) return;

        if (this.sfxAudioSource && itemData.collectionSound) this.sfxAudioSource.playOneShot(itemData.collectionSound);

        const currentAmount = this.goalProgress[goalIndex] + 1;
        this.goalProgress[goalIndex] = currentAmount;
        this.collectedItemsPerGoal[goalIndex].add(itemId);

        // --- NEW TRANSITION LOGIC START ---
        // We check if this specific UI tracker just finished
        const isGoalFinished = currentAmount >= goal.requiredAmount;
        if (isGoalFinished && goal.trackerUI === this.sceneTriggerTracker) {
            if (!this.isGameOver) {
                console.log("Trigger Goal Reached! Transitioning...");
                this.endGame(true);
                // We don't return here because we still want to see the animation fly to the UI
            }
        }
        // --- NEW TRANSITION LOGIC END ---

        const animNode = new Node('CollectedItemAnimation');
        const sprite = animNode.addComponent(Sprite);
        sprite.spriteFrame = itemData.colorSprite;
        const startNodePos = this.uiCanvas.getComponent(UITransform)!.convertToNodeSpaceAR(this.itemContainer.getComponent(UITransform)!.convertToWorldSpaceAR(startPosition));
        const targetNodePos = this.uiCanvas.getComponent(UITransform)!.convertToNodeSpaceAR(goal.trackerUI.node.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO));
        const centerScreenPos = new Vec3(0, 700, 0);

        this.uiCanvas.addChild(animNode);
        animNode.setPosition(startNodePos);
        animNode.setSiblingIndex(9999);
        const randomRotation = (Math.random() - 0.5) * 360;
        
        tween(animNode).to(0.2, { position: centerScreenPos, scale: new Vec3(3, 3, 1) }, { easing: 'quadOut' })
            .delay(0.1).to(0.5, { position: targetNodePos, scale: new Vec3(0.5, 0.5, 1), eulerAngles: new Vec3(0, 0, randomRotation) }, { easing: 'cubicIn' })
            .call(() => {
                goal.trackerUI.updateProgress(currentAmount, goal.requiredAmount);
                goal.trackerUI.playCollectionEffect();

                if (currentAmount >= goal.requiredAmount) {
                    this.scheduleOnce(() => { if (goal.trackerUI?.isValid) goal.trackerUI.playCompletionAnimationAndHide() }, 0.5);
                }

                // Standard win condition (all goals met)
                const allGoalsMet = this.collectionGoals.every((g, index) => this.goalProgress[index] >= g.requiredAmount);
                if (allGoalsMet && !this.isGameOver) {
                    this.endGame(true);
                }
                
                animNode.destroy();
                this.scheduleOnce(() => this.checkAndShowStuckHint(), 0.5);
            }).start();
    }
    
    public requestNewItemFromUI() {
        if (this.isGameOver) return;
        this.spawnButtonClickCount++;
        if (this.isSpawnHintActive) {
            this.cleanupSpawnHint();
        }
        this.spawnNextNeededItem(); 
    }
    
    spawnNextNeededItem() {
        if (this.isGameOver) return;
        let uncollectedItemIds: number[] = [];
        this.collectionGoals.forEach((goal, index) => {
            const neededForThisGoal = goal.itemIds.filter(id => !this.collectedItemsPerGoal[index].has(id));
            uncollectedItemIds.push(...neededForThisGoal);
        });
        if (uncollectedItemIds.length === 0) return;
        const allItemsOnBoard = this.itemContainer.children.map(c => c.getComponent(ItemController)).filter(c => c !== null);
        const relevantItemsOnBoard = allItemsOnBoard.filter(item => uncollectedItemIds.indexOf(item.itemId) !== -1);
        let itemToSpawnId: number | null = null;
        if (relevantItemsOnBoard.length > 0) {
            const itemCountsOnBoard = new Map<number, number>();
            relevantItemsOnBoard.forEach(item => { itemCountsOnBoard.set(item.itemId, (itemCountsOnBoard.get(item.itemId) || 0) + 1); });
            const lonelyItems: number[] = [];
            for (const [itemId, count] of itemCountsOnBoard.entries()) {
                if (count % 2 !== 0) lonelyItems.push(itemId);
            }
            if (lonelyItems.length > 0) {
                itemToSpawnId = lonelyItems[Math.floor(randomRange(0, lonelyItems.length))];
            }
        }
        if (itemToSpawnId === null) {
            itemToSpawnId = uncollectedItemIds[Math.floor(randomRange(0, uncollectedItemIds.length))];
        }
        if (itemToSpawnId !== null) {
            const spawnPosition = this.getSpawningPosition();
            this.createItem(itemToSpawnId, 0, spawnPosition);
        }
    }
    
    tryStartHandTutorial() {
        if (this.isSpawnHintActive || this.isInitialTutorialActive || this.isTutorialActive || this.isGameOver || !this.tutorialController) return;
        this.idleTime = 0;
        let tutorialPair: Node[] | null = null;
        const levelOneItemsById = new Map<number, Node[]>();
        const levelZeroItemsById = new Map<number, Node[]>();
        this.itemContainer.children.forEach(itemNode => {
            const controller = itemNode.getComponent(ItemController);
            if (controller && itemNode.active) {
                const map = controller.itemLevel === 1 ? levelOneItemsById : levelZeroItemsById;
                if (!map.has(controller.itemId)) map.set(controller.itemId, []);
                map.get(controller.itemId)!.push(itemNode);
            }
        });
        for (const nodes of levelOneItemsById.values()) { if (nodes.length >= 2) { tutorialPair = nodes.slice(0, 2); break; } }
        if (!tutorialPair) { for (const nodes of levelZeroItemsById.values()) { if (nodes.length >= 2) { tutorialPair = nodes.slice(0, 2); break; } } }
        if (tutorialPair) {
            this.setupIdleSpotlight(tutorialPair[0], tutorialPair[1]);
            this.isTutorialActive = true;
            if (this.tutorialController) {
                const tc: any = this.tutorialController as any;
                if (typeof tc.playDragTutorial === 'function') tc.playDragTutorial(tutorialPair[0], tutorialPair[1]);
            }
        }
    }
    
    private onTimeUp() {
        console.log("GameManager (Scene 1) heard TIME_UP event!");
        if (!this.isGameOver) {
            // --- Analytics: Time up = Challenge Failed ---
            if (Analytics.instance) {
                Analytics.instance.dispatchEvent(analyticsEvents.CHALLENGE_FAILED);
                console.log("TRACKING: ⏰ CHALLENGE_FAILED event sent (Time Up - Merge Game)");
            }
            this.endGame(false);
        }
    }
    
    endGame(didWin: boolean) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        if (this.bgmAudioSource) this.bgmAudioSource.stop();
        
        // Clean up pre-drag animator if still active
        if (this.preDragAnimatorNode && this.preDragAnimatorNode.isValid) {
            this.preDragAnimatorNode.destroy();
            this.preDragAnimatorNode = null;
        }
        
        this.cleanupSpawnHint();
        this.cleanupInitialTutorial();
        this.cleanupIdleSpotlight();
        if (this.tutorialController) this.tutorialController.stopTutorial();
    
        if (didWin) {
            // --- Analytics: Win sequence ---
            if (Analytics.instance) {
                Analytics.instance.dispatchEvent(analyticsEvents.CHALLENGE_SOLVED);
                console.log("TRACKING: 🏆 CHALLENGE_SOLVED event sent (Merge Game)");
            }
            if (this.winSceneName) {
                this.scheduleOnce(() => director.loadScene(this.winSceneName), 0.5); 
            } else {
                console.error("Win Scene Name is not set in GameManager!");
            }
        } else {
              console.log("TRACKING: 💀 Level 1 (Merge) Lost/TimeUp. Showing 'Try Again' Screen.");
            if (this.endScreenNode) {
                this.endScreenNode.active = true;
                if (this.endScreenTitleLabel) {
                    this.endScreenTitleLabel.string = this.loseMessage;
                }
                // --- Analytics: Endcard shown on loss ---
                if (Analytics.instance) {
                    Analytics.instance.dispatchEvent(analyticsEvents.ENDCARD_SHOWN);
                    console.log("TRACKING: 📺 ENDCARD_SHOWN event sent (Merge Game - Loss)");
                }
            }
        }
    }
    
   private runInitialTutorialStep() { 
    if (!this.isInitialTutorialActive) return;

    // --- NEW LOGIC: Find a specific tutorial pair by ID ---
    
    // 1. Get the specific ID we want to feature from the Inspector.
    const targetId = this.tutorialItemId;
    
    // 2. Find ALL items on the board that match this specific ID.
    const tutorialItems = this.itemContainer.children.filter(item => {
        const controller = item.getComponent(ItemController);
        return controller && controller.itemId === targetId && item.active;
    });

    // 3. Check if we have at least two of them to form a pair.
    let startNode: Node | null = null;
    let endNode: Node | null = null;

    if (tutorialItems.length >= 3) {
        startNode = tutorialItems[0];
        endNode = tutorialItems[1];
    }
    // --- END NEW LOGIC ---

    if (startNode && endNode) {
        console.log(`Starting initial DRAG tutorial for item ID ${targetId} between:`, startNode.name, "and", endNode.name);

        this.setupInitialTutorial(startNode, endNode);
        this.isTutorialActive = true;
        
        this.scheduleOnce(() => {
            if (this.isInitialTutorialActive && this.tutorialController) {
                this.tutorialController.playDragTutorial(startNode!, endNode!);
            }
        }, 0.5);

    } else {
        console.warn(`Could not find a valid pair for tutorial item ID ${targetId}. Cancelling initial tutorial.`);
        // Clean up everything because the tutorial cannot run
        if (this.dragToMatchText) { this.dragToMatchText.active = false; }
        this.isInitialTutorialActive = false;
        if (this.tutorialController) this.tutorialController.stopTutorial();
    }
}
    
    private setupInitialTutorial(startNode: Node, endNode: Node) {
        if (!this.tutorialSpotlightOverlay) return;
        const overlaySprite = this.tutorialSpotlightOverlay.getComponent(Sprite);
        if (overlaySprite) overlaySprite.color = new Color(0, 0, 0, this.TUTORIAL_DARK_OPACITY);
        this.originalStartNodeParent = startNode.parent;
        this.reparentItemToOverlay(startNode);
        this.reparentItemToOverlay(endNode);
        if (this.spotlightGlow1) this.spotlightGlow1.setPosition(startNode.position);
        if (this.spotlightGlow2) this.spotlightGlow2.setPosition(endNode.position);
        this.tutorialSpotlightOverlay.active = true;
    }
     
    private cleanupInitialTutorial(mergedItem?: Node | null) {
        if (!this.originalStartNodeParent || !this.isInitialTutorialActive) return;
        this.isInitialTutorialActive = false;
        if (mergedItem?.isValid) {
            const worldPos = mergedItem.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(mergedItem.position);
            mergedItem.setParent(this.originalStartNodeParent);
            mergedItem.setPosition(this.originalStartNodeParent.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos));
        }
        if (this.tutorialSpotlightOverlay) this.tutorialSpotlightOverlay.active = false;
        this.isTutorialActive = false;
        if(this.tutorialController) this.tutorialController.stopTutorial();
        this.originalStartNodeParent = null;
    }
     
    private setupIdleSpotlight(item1: Node, item2: Node) {
        if (!this.tutorialSpotlightOverlay) return;
        const overlaySprite = this.tutorialSpotlightOverlay.getComponent(Sprite);
        if (overlaySprite) overlaySprite.color = new Color(0, 0, 0, this.SPOTLIGHT_DARK_OPACITY);
        this.isIdleSpotlightActive = true;
        this.idleSpotlightItems = [item1, item2];
        this.reparentItemToOverlay(item1);
        this.reparentItemToOverlay(item2);
        const targetScale = new Vec3(1.15, 1.15, 1);
        tween(item1).to(0.4, { scale: targetScale }, { easing: 'backOut' }).start();
        tween(item2).to(0.4, { scale: targetScale }, { easing: 'backOut' }).start();
        [this.spotlightGlow1, this.spotlightGlow2].forEach((glowNode, index) => {
            if (glowNode) {
                glowNode.active = true;
                glowNode.setPosition(index === 0 ? item1.position : item2.position);
                tween(glowNode).sequence(tween().to(0.6, { scale: new Vec3(1.15, 1.15, 1) }), tween().to(0.6, { scale: new Vec3(1, 1, 1) })).repeatForever().start();
            }
        });
        this.tutorialSpotlightOverlay.active = true;
    }
    
    private cleanupIdleSpotlight() {
        if (!this.isIdleSpotlightActive) return;
        for (const item of this.idleSpotlightItems) {
            if (item?.isValid) {
                Tween.stopAllByTarget(item);
                tween(item).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
                item.setParent(this.itemContainer); 
            }
        }
        if (this.tutorialSpotlightOverlay) this.tutorialSpotlightOverlay.active = false;
        [this.spotlightGlow1, this.spotlightGlow2].forEach(glowNode => { if(glowNode) { Tween.stopAllByTarget(glowNode); glowNode.active = false; }});
        this.isIdleSpotlightActive = false;
        this.isTutorialActive = false;
        if(this.tutorialController) this.tutorialController.stopTutorial();
        this.idleSpotlightItems = [];
    }

    reparentItemToOverlay(item: Node) { 
        const overlayUIT = this.tutorialSpotlightOverlay!.getComponent(UITransform); 
        if (!overlayUIT || !item.parent) return; 
        const worldPos = item.parent.getComponent(UITransform)!.convertToWorldSpaceAR(item.position); 
        item.setParent(this.tutorialSpotlightOverlay); 
        item.setPosition(overlayUIT.convertToNodeSpaceAR(worldPos)); 
    }
    
    spawnInitialItems() { 
        const numberOfItemsToSpawn = 6;
        if (this.initialSpawnItemIds && this.initialSpawnItemIds.length > 0) { 
            for (const itemId of this.initialSpawnItemIds) this.createItem(itemId, 0, this.getSpawningPosition()); 
            return;
        }
        let allPossibleNeededItems = this.collectionGoals.reduce((allIds, goal) => allIds.concat(goal.itemIds), [] as number[]);
        this.shuffleArray(allPossibleNeededItems);
        const itemsToSpawn = allPossibleNeededItems.slice(0, Math.min(numberOfItemsToSpawn, allPossibleNeededItems.length));
        for (const itemId of itemsToSpawn) this.createItem(itemId, 0, this.getSpawningPosition());
    }
    
    private refillAndShuffleSpawnLanes() {
        this.spawnLaneQueue = [];
        for (let i = 0; i < this.NUM_SPAWN_LANES; i++) this.spawnLaneQueue.push(i);
        this.shuffleArray(this.spawnLaneQueue);
    }
    
    private shuffleArray(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    getSpawningPosition(): Vec3 {
        const itemContainerUIT = this.itemContainer.getComponent(UITransform);
        if (!itemContainerUIT) return new Vec3(0, 1000, 0);
        let spawnX: number;
        let leftEdgeX: number;
        let totalSpawnWidth: number;
        if (this.spawnRangeLeftMarker && this.spawnRangeRightMarker) {
            const leftWorldPos = this.spawnRangeLeftMarker.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO);
            const rightWorldPos = this.spawnRangeRightMarker.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO);
            const localLeft = itemContainerUIT.convertToNodeSpaceAR(leftWorldPos);
            const localRight = itemContainerUIT.convertToNodeSpaceAR(rightWorldPos);
            leftEdgeX = localLeft.x;
            totalSpawnWidth = localRight.x - localLeft.x;
        } else {
            const containerWidth = itemContainerUIT.width;
            const padding = 50;
            leftEdgeX = -containerWidth / 2 + padding;
            totalSpawnWidth = containerWidth - (padding * 2);
        }
        if (this.spawnLaneQueue.length === 0) this.refillAndShuffleSpawnLanes();
        const nextLane = this.spawnLaneQueue.pop()!;
        const laneWidth = totalSpawnWidth / this.NUM_SPAWN_LANES;
        spawnX = leftEdgeX + (nextLane * laneWidth) + (laneWidth / 2);
        return new Vec3(spawnX, itemContainerUIT.height / 2 + 650, 0);
    }
    
    createItem(itemId: number, level: number, position: Vec3): Node | null { 
        const itemData = this.itemDefinitions.find(d => d.itemId === itemId); 
        if (!itemData) return null; 
        const itemNode = instantiate(this.itemBasePrefab); 
        const sprite = itemNode.getComponent(Sprite); 
        if (sprite) {
            if (level === 0) sprite.spriteFrame = itemData.outlineSprite; 
            else if (level === 1) sprite.spriteFrame = itemData.graySprite; 
            else if (level === 2) sprite.spriteFrame = itemData.colorSprite; 
        }
        const rb = itemNode.getComponent(RigidBody2D); 
        if(rb) { rb.linearDamping = 0.5; rb.angularDamping = 0.8; rb.gravityScale = 10; }
        const collider = itemNode.getComponent(BoxCollider2D); 
        if (collider) {
            this.scheduleOnce(() => { 
                if (itemNode.isValid) { 
                    const size = itemNode.getComponent(UITransform)!.contentSize; 
                    collider.size = new Size(size.width, size.height); 
                    collider.apply(); 
                } 
            }); 
        }
        const controller = itemNode.getComponent(ItemController); 
        if(controller) controller.setup(itemId, level, this); 
        this.itemContainer.addChild(itemNode); 
        itemNode.setPosition(position); 
        return itemNode; 
    }
}