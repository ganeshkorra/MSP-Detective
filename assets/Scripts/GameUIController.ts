import { _decorator, Component, Node, director, CCString, VideoPlayer } from 'cc';
import { TutorialHandController } from './TutorialHandController';

const { ccclass, property } = _decorator;

@ccclass('GameUIController')
export class GameUIController extends Component {

    @property({
        type: [Node],
        tooltip: "Drag UI panels (like a CTA Canvas) here that this script can activate."
    })
    public managedCanvases: Node[] = [];

    @property({
        type: [Node],
        tooltip: "Drag any nodes here that should be hidden when a managed canvas is shown."
    })
    public nodesToHide: Node[] = [];

    @property({ 
        type: VideoPlayer,
        tooltip: "Drag the node with the VideoPlayer component here."
    })
    public videoPlayer: VideoPlayer = null;
    
    @property({ 
        type: TutorialHandController,
        tooltip: "Drag the TutorialHand node which has the TutorialHandController script."
    })
    public tutorialHandController: TutorialHandController = null;
    

    start() {
        // Hide all managed canvases at the start
        this.managedCanvases.forEach(canvas => { 
            if (canvas) canvas.active = false; 
        });

        // Ensure the hand tutorial is hidden at the start
        if (this.tutorialHandController) {
            this.tutorialHandController.node.active = false;
        }
    }
    
    /**
     * This function is called by the VideoPlayer's events.
     */
    public onVideoPlayerEvent(player: VideoPlayer, eventType: VideoPlayer.EventType) {
        if (eventType === VideoPlayer.EventType.COMPLETED) {
            if (this.tutorialHandController) {
                console.log("Video completed. Starting hand tutorial.");
                this.tutorialHandController.startAnimation();
            }
        }
    }
    
    /**
     * This function should be linked to the 'YES' button's Click Event.
     */
    public onYesButtonClicked() {
        console.log("'YES' button clicked. Firing click effect and loading next scene.");

        // Tell the hand controller to show its click effect and hide.
        if (this.tutorialHandController) {
            this.tutorialHandController.showClickEffect();
        }

        // Load the next scene after a short delay to let the click effect play.
        this.scheduleOnce(() => {
            director.loadScene("NextScene1"); // Make sure your scene name is correct
        }, 0.2);
    }

    /**
     * This function can be linked to other buttons (like the 'NO' button).
     */
    public showManagedCanvas(event: Event, canvasIndexStr: string) {
        const index = parseInt(canvasIndexStr);
        if (isNaN(index)) {
            console.error("CustomEventData must be a number!");
            return;
        }

        if (this.managedCanvases[index]) {
            this.managedCanvases[index].active = true;
            this.nodesToHide.forEach(node => { 
                if (node) node.active = false; 
            });
        } else {
            console.error(`No canvas at index ${index}!`);
        }
    }

    /**
     * A generic function for buttons that just need to load a scene.
     */
    public loadSceneByName(event: Event, sceneName: string) {
        if (sceneName) {
            director.loadScene(sceneName);
        } else {
            console.error("Button is missing sceneName in CustomEventData!");
        }
    }
}