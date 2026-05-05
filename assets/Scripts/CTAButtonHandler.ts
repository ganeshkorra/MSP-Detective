import { _decorator, Component, AudioSource, find, CCString } from 'cc';

// Declare the mraid object to TypeScript to avoid compilation errors.
// This object is provided by the ad container environment at runtime.
declare const mraid: any;

const { ccclass, property } = _decorator;

@ccclass('CTAButtonHandler')
export class CTAButtonHandler extends Component {
    
    @property({
        type: CCString,
        tooltip: 'The app store URL to open on click.'
    })
    public storeUrl: string = "https://play.google.com/store/apps/details?id=com.game.goolny.stickers";

    private isMraidReady: boolean = false;

    onLoad() {
        // Check if the MRAID object is present in the environment
        if (typeof mraid !== 'undefined') {
            console.log("MRAID environment detected.");
            // As per MRAID spec, wait for the 'ready' event before using any mraid functions.
            if (mraid.getState() === 'loading') {
                console.log("MRAID is loading. Waiting for the 'ready' event...");
                mraid.addEventListener('ready', this.onMraidReady.bind(this));
            } else {
                // If state is already 'default', 'expanded', etc., we are ready to go.
                this.onMraidReady();
            }
        } else {
            console.warn("MRAID library not found. Clicks will use a fallback 'window.open'.");
        }
    }

    /**
     * This function is called once the MRAID environment is ready.
     */
    private onMraidReady(): void {
        console.log("MRAID is ready. Click-through will use mraid.open().");
        this.isMraidReady = true;
    }

    /**
     * This method should be linked to the CTA button's click event in the editor.
     */
    public onStoreButtonClicked(): void {
        console.log("Store button clicked!");

        // Standard practice: stop audio before redirecting
        const mainAudio = find("Canvas-001/GameCamera")?.getComponent(AudioSource);
        if (mainAudio) {
            mainAudio.stop();
        }

        // Use mraid.open() if the environment is ready (Primary method)
        if (this.isMraidReady) {
            console.log("Calling mraid.open() with URL:", this.storeUrl);
            mraid.open(this.storeUrl);
        } else {
            // Fallback for local testing or non-MRAID environments
            console.log(`FALLBACK: MRAID not available. Opening URL with window.open: ${this.storeUrl}`);
            window.open(this.storeUrl, "_blank");
        }
    }
}